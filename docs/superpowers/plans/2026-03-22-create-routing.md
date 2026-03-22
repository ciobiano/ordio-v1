# Create Route Routing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `/create` page with `app/create/layout.tsx` + `app/create/page.tsx` (idle/recording/processing) + `app/create/export/[sessionId]/page.tsx` (Convex-backed export with tier-based retention).

**Architecture:** Each user recording session is persisted to Convex (`sessions` table) with audio stored in Convex file storage. The export phase gets its own URL (`/create/export/[sessionId]`), making it deep-linkable, refresh-safe, and shareable. Free users get 24h retention; creator/pro users get 30 days. A Convex cron job deletes expired sessions hourly.

**Tech Stack:** Next.js 15 App Router, Convex (file storage + database + cron), Zustand, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-create-routing-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/convex/convex/schema.ts` | Modify | Add `sessions` table |
| `packages/convex/convex/sessions.ts` | Create | `createSession`, `getSession`, `getAudioUrl`, internal `cleanupExpired` |
| `packages/convex/convex/crons.ts` | Create | Schedule hourly `cleanupExpired` |
| `apps/web/src/lib/store.ts` | Modify | Remove `'export'` from `AppPhase`; add `upgradeTarget` state |
| `apps/web/src/hooks/useAudioProcessing.ts` | Modify | Accept `tier` param, return `Promise<string>` (sessionId), add parallel Convex upload |
| `apps/web/src/app/create/layout.tsx` | Create | Auth, CapabilityBanner, UserButton, UpgradeSheet, OnboardingDialog, watermark, `usePaymentRedirect` |
| `apps/web/src/app/create/page.tsx` | Modify | Remove export branch; pass `tier` to `processAudio`; `router.push` on completion |
| `apps/web/src/app/create/export/[sessionId]/page.tsx` | Create | Convex guard, audio hydration, ExportState render, expiry notice |
| `apps/web/src/__tests__/useAudioProcessing.test.ts` | Create | Test new signature and Convex upload integration |

---

## Task 1: Add `sessions` table to Convex schema

**Files:**
- Modify: `packages/convex/convex/schema.ts`

- [ ] **Step 1: Add the sessions table**

Open `packages/convex/convex/schema.ts`. Add the `sessions` table after the `users` table:

```ts
// packages/convex/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jobs: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("uploading"),
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    config: v.any(),
    storageId: v.string(),
    renderedVideoId: v.optional(v.string()),
    error: v.optional(v.string())
  })
  .index("by_user_id", ["userId"])
  .index("by_status", ["status"]),

  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    usageCount: v.number(),
    lastResetTime: v.number(),
    stripeCustomerId: v.optional(v.string()),
    paystackCustomerCode: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'))
    ),
  })
  .index("by_token", ["tokenIdentifier"])
  .index("by_stripe_customer", ["stripeCustomerId"])
  .index("by_paystack_customer", ["paystackCustomerCode"]),

  sessions: defineTable({
    userId:      v.string(),
    storageId:   v.id("_storage"),
    mimeType:    v.string(),
    durationSec: v.number(),
    transcript:  v.array(v.object({
      text:  v.string(),
      start: v.number(),
      end:   v.number(),
    })),
    tier:        v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    expiresAt:   v.number(),
    createdAt:   v.number(),
  })
  .index("by_user_id", ["userId"])
  .index("by_expires_at", ["expiresAt"]),
});
```

- [ ] **Step 2: Verify Convex types regenerate**

```bash
cd packages/convex && npx convex dev --once 2>&1 | head -20
```

Expected: no schema errors. The `_generated/` types update to include `api.sessions`.

---

## Task 2: Create `packages/convex/convex/sessions.ts`

**Files:**
- Create: `packages/convex/convex/sessions.ts`

The `generateUploadUrl` mutation already exists in `jobs.ts` — reuse it for the audio upload step. This file provides session CRUD and cleanup.

- [ ] **Step 1: Create the file**

```ts
// packages/convex/convex/sessions.ts
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./auth";

const RETENTION_MS: Record<string, number> = {
  free:    24 * 60 * 60 * 1000,       // 24 hours
  creator: 30 * 24 * 60 * 60 * 1000,  // 30 days
  pro:     30 * 24 * 60 * 60 * 1000,  // 30 days (same as creator)
};

/**
 * Creates a new audio session after upload + transcription complete.
 * Returns the session document ID (used as the URL segment).
 */
export const createSession = mutation({
  args: {
    storageId:   v.id("_storage"),
    mimeType:    v.string(),
    durationSec: v.number(),
    transcript:  v.array(v.object({
      text:  v.string(),
      start: v.number(),
      end:   v.number(),
    })),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const retention = RETENTION_MS[args.tier] ?? RETENTION_MS.free;

    return await ctx.db.insert("sessions", {
      userId:      user.tokenIdentifier,
      storageId:   args.storageId,
      mimeType:    args.mimeType,
      durationSec: args.durationSec,
      transcript:  args.transcript,
      tier:        args.tier,
      expiresAt:   now + retention,
      createdAt:   now,
    });
  },
});

/**
 * Fetches a session by ID. Returns null if not found or expired.
 * Used by the export page to render and guard.
 */
export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  },
});

/**
 * Returns a short-lived signed URL for the audio file in Convex storage.
 * Used by the export page to fetch + decode audio on direct navigation.
 */
export const getAudioUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

/**
 * Internal: deletes all expired sessions and their audio files.
 * Called hourly by the cron job in crons.ts.
 */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .collect();

    await Promise.all(
      expired.map(async (session) => {
        await ctx.storage.delete(session.storageId);
        await ctx.db.delete(session._id);
      })
    );

    return { deleted: expired.length };
  },
});
```

- [ ] **Step 2: Regenerate types**

```bash
cd packages/convex && npx convex dev --once 2>&1 | head -20
```

Expected: `api.sessions.createSession`, `api.sessions.getSession`, `api.sessions.getAudioUrl` all appear in `_generated/api.d.ts`.

---

## Task 3: Create `packages/convex/convex/crons.ts`

**Files:**
- Create: `packages/convex/convex/crons.ts`

- [ ] **Step 1: Create the cron file**

```ts
// packages/convex/convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  internal.sessions.cleanupExpired,
  {}
);

export default crons;
```

- [ ] **Step 2: Verify**

```bash
cd packages/convex && npx convex dev --once 2>&1 | head -20
```

Expected: no errors; cron appears in Convex dashboard.

---

## Task 4: Update `store.ts` — remove `'export'` from `AppPhase`, add `upgradeTarget`

**Files:**
- Modify: `apps/web/src/lib/store.ts`

`upgradeTarget` moves from local component state in `page.tsx` to the store so both `page.tsx` and `export/[sessionId]/page.tsx` can set it, and `layout.tsx` can read it to show `<UpgradeSheet>`.

- [ ] **Step 1: Update the file**

Change line 7 — remove `'export'` from `AppPhase`:

```ts
export type AppPhase = 'idle' | 'recording' | 'processing';
```

Add `upgradeTarget` to `AppState` interface (after the `enhanceProgress` line):

```ts
  // Upgrade sheet
  upgradeTarget: FeatureKey | 'export_limit' | null;
  setUpgradeTarget: (target: FeatureKey | 'export_limit' | null) => void;
```

Add the import for `FeatureKey` at the top (after the existing imports):

```ts
import type { FeatureKey } from '@/lib/featureGates';
```

Add to `initialSession` (after `enhanceProgress: 0`):

```ts
  upgradeTarget: null as FeatureKey | 'export_limit' | null,
```

Add the action implementation inside `create()` (after `setEnhanceProgress`):

```ts
      setUpgradeTarget: (upgradeTarget) => set({ upgradeTarget }),
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: errors on any remaining `currentState === 'export'` or `setCurrentState('export')` usages — these will be fixed in subsequent tasks.

---

## Task 5: Update `useAudioProcessing.ts` — new signature with Convex upload

**Files:**
- Modify: `apps/web/src/hooks/useAudioProcessing.ts`

`processAudio` changes from `(blob: Blob) => Promise<void>` to `(blob: Blob, tier: UserTier) => Promise<string>`. The internal `setCurrentState('export')` call is removed. A parallel Convex upload runs alongside Whisper transcription.

The upload flow uses the existing `api.jobs.generateUploadUrl` mutation (two-step Convex storage pattern):
1. `generateUploadUrl()` → one-time POST URL
2. `fetch(postUrl, { method: 'POST', body: blob })` → `{ storageId }`
3. `createSession({ storageId, transcript, ... })` → `sessionId`

- [ ] **Step 1: Rewrite the file**

```ts
// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { Id } from '@Ordio/convex/_generated/dataModel';
import { useStore } from '@/lib/store';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';
import type { UserTier } from '@/lib/featureGates';

interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob, tier: UserTier) => Promise<string>;
}

/**
 * Handles the decode → transcribe → upload → finalize pipeline.
 * Returns a Convex session ID that the caller uses to navigate to
 * /create/export/[sessionId].
 */
export function useAudioProcessing(
  transcription: UseTranscriptionReturn
): UseAudioProcessingReturn {
  const {
    setCurrentState,
    setAudioBuffer,
    setAudioBlob,
    setAudioDuration,
    setTranscript,
    setTranscriptionSource,
    setIsEnhancing,
    setEnhanceProgress,
  } = useStore();

  const [processingProgress, setProcessingProgress] = useState(0);

  const transcriptionRef = useRef(transcription);
  transcriptionRef.current = transcription;

  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);

  // Stable refs so processAudio closure doesn't change identity when
  // mutation references update between renders.
  const generateUploadUrlRef = useRef(generateUploadUrl);
  generateUploadUrlRef.current = generateUploadUrl;

  const createSessionRef = useRef(createSession);
  createSessionRef.current = createSession;

  const processAudio = useCallback(
    async (inputBlob: Blob, tier: UserTier): Promise<string> => {
      let blob = inputBlob;
      const rawBlob = inputBlob;
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const { enhanceTier } = useStore.getState();
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        const audioCtx = new AudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        void audioCtx.close();
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setProcessingProgress(decodeEnd);

        // Step 2: Enhance audio if tier selected (15–40%)
        if (enhanceTier !== 'none') {
          setIsEnhancing(true);
          setProcessingProgress(15);
          const result = await enhanceAudio(blob, enhanceTier, (p) => {
            setEnhanceProgress(p);
            setProcessingProgress(15 + (p / 100) * 25);
          });
          if (result.ok) {
            const enhancedCtx = new AudioContext();
            const enhancedBuffer = await enhancedCtx.decodeAudioData(
              await result.blob.arrayBuffer()
            );
            void enhancedCtx.close();
            setAudioBuffer(enhancedBuffer);
            setAudioDuration(enhancedBuffer.duration);
            blob = result.blob;
          }
          setIsEnhancing(false);
          setEnhanceProgress(0);
          setProcessingProgress(40);
        }

        // Step 3: Transcribe + upload in parallel (25–85%)
        const baseTranscribe = enhanceTier !== 'none' ? 40 : 25;
        setProcessingProgress(baseTranscribe + 5);

        const [words, storageId] = await Promise.all([
          // 3a: Whisper transcription
          transcriptionRef.current.transcribeAudio(rawBlob),

          // 3b: Upload audio to Convex storage (two-step)
          (async () => {
            const uploadUrl = await generateUploadUrlRef.current();
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': blob.type },
              body: blob,
            });
            if (!uploadRes.ok) throw new Error('Audio upload failed');
            const { storageId } = await uploadRes.json() as { storageId: string };
            return storageId as Id<'_storage'>;
          })(),
        ]);

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        }
        setProcessingProgress(85);

        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await createSessionRef.current({
          storageId,
          mimeType:    blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript:  words,
          tier,
        });

        // Step 5: Finalize
        setProcessingProgress(100);
        await new Promise((r) => setTimeout(r, 250));

        return sessionId;
      } catch {
        setCurrentState('idle');
        throw new Error('Audio processing failed');
      }
    },
    [
      setCurrentState,
      setAudioBuffer,
      setAudioBlob,
      setAudioDuration,
      setTranscript,
      setTranscriptionSource,
      setIsEnhancing,
      setEnhanceProgress,
    ]
  );

  return { processingProgress, processAudio };
}
```

**Note on `storageId` type:** Convex's `v.id("_storage")` validator accepts the string returned by the upload endpoint. The cast `as \`${string}\`` satisfies the branded ID type.

- [ ] **Step 2: Check TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep useAudioProcessing
```

Expected: no errors in this file. (Errors may appear in callers until Task 7.)

---

## Task 6: Create `app/create/layout.tsx`

**Files:**
- Create: `apps/web/src/app/create/layout.tsx`

This layout wraps all `/create/*` routes. It handles: auth gate, shared UI chrome, payment redirect, onboarding dialog. `UpgradeSheet` reads `upgradeTarget` from Zustand so any nested page can trigger it.

- [ ] **Step 1: Create the layout**

```tsx
// apps/web/src/app/create/layout.tsx
'use client';

import { Suspense } from 'react';
import { useStore } from '@/lib/store';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCheckout } from '@/hooks/useCheckout';
import { usePaymentRedirect } from '@/hooks/usePaymentRedirect';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { CapabilityBanner } from '@/components/primitives';
import { AuthGate, UpgradeSheet, OnboardingDialog } from '@/components/soul';

function CreateLayoutContent({ children }: { children: React.ReactNode }) {
  const { upgradeTarget, setUpgradeTarget } = useStore();
  const capabilities = useCapabilities();
  const { isLoading } = useCurrentUser();
  const { isSignedIn } = useAuth();
  const { startCheckout } = useCheckout();

  usePaymentRedirect();

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-black flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-dvh bg-black text-[--primary] font-[family-name:var(--font-jakarta)]">
      {!capabilities.isLoading && <CapabilityBanner warnings={capabilities.warnings} />}

      {children}

      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
        onUpgrade={() =>
          startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))
        }
      />

      <OnboardingDialog />

      <div
        className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 text-white/8 text-[length:var(--text-footnote)]
                   tracking-[0.2em] uppercase pointer-events-none select-none"
        aria-hidden="true"
      >
        ordio
      </div>
    </div>
  );
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <CreateLayoutContent>{children}</CreateLayoutContent>
    </Suspense>
  );
}
```

---

## Task 7: Refactor `app/create/page.tsx`

**Files:**
- Modify: `apps/web/src/app/create/page.tsx`

Remove: export phase branch, `ExportState` import, `usePaymentRedirect`, `useCheckout`, `UpgradeSheet`, `OnboardingDialog`, watermark, loading/auth gate (moved to layout).

Add: `router.push` on processing completion, `tier` passed to `processAudio`.

- [ ] **Step 1: Replace the file**

```tsx
// apps/web/src/app/create/page.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useTranscription } from '@/hooks/useTranscription';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCapabilities } from '@/hooks/useCapabilities';

import {
  IdleState,
  RecordingState,
  ProcessingState,
} from '@/components/soul';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function CreatePage() {
  const router = useRouter();
  const {
    currentState,
    setCurrentState,
    setUpgradeTarget,
    reset,
  } = useStore();

  const [audioLevel, setAudioLevel] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);
  const { tier } = useCurrentUser();
  const capabilities = useCapabilities();

  // Audio level animation during recording
  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const tick = () => {
      setAudioLevel(analyser.getAudioLevel());
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [recorder.isRecording, analyser]);

  const handleStartRecording = useCallback(async () => {
    transcription.clearTranscript();
    const stream = await recorder.startRecording();
    if (!stream) {
      toast.error(recorder.error ?? 'Microphone access denied. Check your browser permissions.');
      return;
    }
    analyser.connectStream(stream);
    setCurrentState('recording');
  }, [recorder, analyser, transcription, setCurrentState]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    analyser.disconnect();
  }, [recorder, analyser]);

  const handleProceed = useCallback(async () => {
    if (!recorder.audioBlob) return;
    try {
      const sessionId = await processAudio(recorder.audioBlob, tier);
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Processing failed');
    }
  }, [recorder.audioBlob, processAudio, tier, router]);

  const handleRestart = useCallback(async () => {
    recorder.resetRecording();
    try {
      await handleStartRecording();
    } catch {
      toast.error('Failed to restart recording');
      setCurrentState('idle');
    }
  }, [recorder, handleStartRecording, setCurrentState]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error('File too large. Maximum 50 MB.');
        return;
      }

      try {
        const sessionId = await processAudio(file, tier);
        router.push(`/create/export/${sessionId}`);
      } catch {
        toast.error('Failed to load audio file. Try MP3, WAV, or M4A.');
      }

      if (e.target) e.target.value = '';
    },
    [processAudio, tier, router]
  );

  const handleReset = useCallback(() => {
    recorder.resetRecording();
    transcription.clearTranscript();
    reset();
  }, [recorder, transcription, reset]);

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
    >
      {(currentState === 'idle') && (
        <div className="fixed top-4 right-4 z-20">
          <UserButton />
        </div>
      )}

      {currentState === 'idle' && (
        <IdleState
          onStartRecording={handleStartRecording}
          onFileUpload={handleFileUpload}
          canRecord={capabilities.canRecord}
          isLoading={false}
          fileInputRef={fileInputRef}
        />
      )}

      {currentState === 'recording' && (
        <RecordingState
          audioLevel={audioLevel}
          isPaused={recorder.isPaused}
          recordingTime={recorder.recordingTime}
          onPauseRecording={recorder.pauseRecording}
          onResumeRecording={recorder.resumeRecording}
          onStopRecording={handleStopRecording}
          onRestart={handleRestart}
          onProceed={handleProceed}
          onCancel={handleReset}
          onLocked={setUpgradeTarget}
        />
      )}

      {currentState === 'processing' && (
        <ProcessingState progress={processingProgress} onCancel={handleReset} />
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentState === 'recording' && 'Recording started'}
        {currentState === 'processing' && 'Processing audio'}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep "create/page"
```

Expected: no errors.

---

## Task 8: Create `app/create/export/[sessionId]/page.tsx`

**Files:**
- Create: `apps/web/src/app/create/export/[sessionId]/page.tsx`

This page guards the session, hydrates audio from Convex storage on direct navigation, and renders `ExportState`. It also shows an expiry notice.

- [ ] **Step 1: Create the page**

```tsx
// apps/web/src/app/create/export/[sessionId]/page.tsx
'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { toast } from 'sonner';
import { UserButton } from '@clerk/nextjs';
import { useStore } from '@/lib/store';
import { useVideoExporter, fileExtension } from '@/hooks/useVideoExporter';
import { usePlayback } from '@/hooks/usePlayback';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useExportGate } from '@/hooks/useExportGate';
import type { Id } from '@Ordio/convex/_generated/dataModel';
import { ExportState } from '@/components/soul';

function formatExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `Saved for ${days} day${days !== 1 ? 's' : ''}`;
  return `Expires in ${hours}h`;
}

export default function ExportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const {
    audioBuffer,
    transcript,
    setAudioBuffer,
    setAudioBlob,
    setTranscript,
    setAudioDuration,
    setUpgradeTarget,
    format,
    waveformStyle,
    captionStyle,
    graphicStyle,
    reset,
  } = useStore();

  const [isHydrating, setIsHydrating] = useState(false);

  const session = useQuery(
    api.sessions.getSession,
    { sessionId: sessionId as Id<'sessions'> }
  );

  const audioUrlResult = useQuery(
    api.sessions.getAudioUrl,
    session ? { storageId: session.storageId } : 'skip'
  );

  const exporter = useVideoExporter();
  const playback = usePlayback();
  const { tier } = useCurrentUser();
  const exportGate = useExportGate();

  // Guard: session undefined = loading; null = not found/expired
  useEffect(() => {
    if (session === undefined) return; // still loading
    if (session === null) {
      toast.error('This recording has expired or could not be found.');
      router.replace('/create');
    }
  }, [session, router]);

  // Hydrate audio from Convex storage when arriving via direct navigation
  useEffect(() => {
    if (!session || !audioUrlResult || audioBuffer) return; // already hydrated
    if (isHydrating) return;

    setIsHydrating(true);

    // Load transcript from session document
    setTranscript(session.transcript);

    // Fetch and decode audio
    const hydrate = async () => {
      try {
        const res = await fetch(audioUrlResult!);
        const arrayBuf = await res.arrayBuffer();
        const audioCtx = new AudioContext();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        void audioCtx.close();

        const blob = new Blob([arrayBuf], { type: session.mimeType });
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
      } catch {
        toast.error('Failed to load your recording.');
        router.replace('/create');
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrate();
  }, [
    session,
    audioUrlResult,
    audioBuffer,
    isHydrating,
    setAudioBuffer,
    setAudioBlob,
    setAudioDuration,
    setTranscript,
    router,
  ]);

  // Load audio into playback once AudioBuffer is ready
  useEffect(() => {
    if (audioBuffer) playback.load(audioBuffer);
  }, [audioBuffer, playback]);

  const handleExportStart = useCallback(async (): Promise<boolean> => {
    const gate = await exportGate.checkAndConsume();
    if (!gate.allowed) {
      setUpgradeTarget('export_limit');
      return false;
    }
    return true;
  }, [exportGate, setUpgradeTarget]);

  const handleDownload = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  const handleReset = useCallback(() => {
    exporter.cancelExport();
    playback.stop();
    reset();
    router.push('/create');
  }, [exporter, playback, reset, router]);

  // Loading state — session still fetching OR audio still hydrating
  if (session === undefined || isHydrating || !audioBuffer) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
    >
      <div className="fixed top-4 right-4 z-20 flex items-center gap-3">
        <span className="text-[length:var(--text-caption)] text-secondary">
          {formatExpiry(session.expiresAt)}
        </span>
        <UserButton />
      </div>

      <ExportState
        playback={playback}
        exporter={exporter}
        format={format}
        waveformStyle={waveformStyle}
        captionStyle={captionStyle}
        graphicStyle={graphicStyle}
        showWatermark={tier === 'free'}
        onExportStart={handleExportStart}
        onDownload={handleDownload}
        onReset={handleReset}
        onLocked={setUpgradeTarget}
      />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Export ready
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep "export/\[sessionId\]"
```

Expected: no errors.

---

## Task 9: Write tests for `useAudioProcessing` new signature

**Files:**
- Create: `apps/web/src/__tests__/useAudioProcessing.test.ts`

These tests verify: (1) `processAudio` returns a sessionId string, (2) navigation to idle on error, (3) the parallel upload pattern. Heavy mocking is required due to Web Audio API and Convex.

- [ ] **Step 1: Write the tests**

```ts
// apps/web/src/__tests__/useAudioProcessing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock @Ordio/convex api
vi.mock('@Ordio/convex', () => ({
  api: {
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
    sessions: { createSession: 'sessions:createSession' },
  },
}));

// Mock store
const mockSetCurrentState = vi.fn();
const mockSetAudioBuffer = vi.fn();
const mockSetAudioBlob = vi.fn();
const mockSetAudioDuration = vi.fn();
const mockSetTranscript = vi.fn();
const mockSetTranscriptionSource = vi.fn();
const mockSetIsEnhancing = vi.fn();
const mockSetEnhanceProgress = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: vi.fn(() => ({
    setCurrentState: mockSetCurrentState,
    setAudioBuffer: mockSetAudioBuffer,
    setAudioBlob: mockSetAudioBlob,
    setAudioDuration: mockSetAudioDuration,
    setTranscript: mockSetTranscript,
    setTranscriptionSource: mockSetTranscriptionSource,
    setIsEnhancing: mockSetIsEnhancing,
    setEnhanceProgress: mockSetEnhanceProgress,
  })),
  getState: vi.fn(() => ({ enhanceTier: 'none' })),
}));

// Mock audio enhance
vi.mock('@/lib/audioEnhanceApi', () => ({
  enhanceAudio: vi.fn(),
}));

// Web Audio API mock
class MockAudioContext {
  decodeAudioData = vi.fn(async () => ({
    duration: 5.0,
    numberOfChannels: 1,
    sampleRate: 44100,
  }));
  close = vi.fn();
}

// @ts-expect-error — browser API mock
global.AudioContext = MockAudioContext;

const mockTranscription = {
  transcribeAudio: vi.fn(async () => [{ text: 'hello', start: 0, end: 1 }]),
  clearTranscript: vi.fn(),
};

describe('useAudioProcessing', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock store.getState().enhanceTier
    const { useStore } = vi.mocked(await import('@/lib/store'));
    (useStore as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      setCurrentState: mockSetCurrentState,
      setAudioBuffer: mockSetAudioBuffer,
      setAudioBlob: mockSetAudioBlob,
      setAudioDuration: mockSetAudioDuration,
      setTranscript: mockSetTranscript,
      setTranscriptionSource: mockSetTranscriptionSource,
      setIsEnhancing: mockSetIsEnhancing,
      setEnhanceProgress: mockSetEnhanceProgress,
    }));
    Object.defineProperty(useStore, 'getState', {
      value: vi.fn(() => ({ enhanceTier: 'none' })),
      configurable: true,
    });
  });

  it('returns a string sessionId on success', async () => {
    const mockGenerateUploadUrl = vi.fn(async () => 'https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn(async () => 'abc123sessionId');

    const { useMutation } = await import('convex/react');
    vi.mocked(useMutation)
      .mockReturnValueOnce(mockGenerateUploadUrl as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockCreateSession as ReturnType<typeof vi.fn>);

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ storageId: 'storage_abc' }),
    })) as ReturnType<typeof vi.fn>;

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn(async () => new ArrayBuffer(8));

    const { result } = renderHook(() =>
      useAudioProcessing(mockTranscription as ReturnType<typeof vi.fn>)
    );

    let sessionId: string | undefined;
    await act(async () => {
      sessionId = await result.current.processAudio(blob, 'free');
    });

    expect(typeof sessionId).toBe('string');
    expect(sessionId).toBe('abc123sessionId');
  });

  it('sets currentState to idle and throws on processing error', async () => {
    const { useMutation } = await import('convex/react');
    vi.mocked(useMutation).mockReturnValue(
      vi.fn(async () => { throw new Error('Upload failed'); })
    );

    global.fetch = vi.fn(async () => ({
      ok: false,
    })) as ReturnType<typeof vi.fn>;

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn(async () => new ArrayBuffer(8));

    const { result } = renderHook(() =>
      useAudioProcessing(mockTranscription as ReturnType<typeof vi.fn>)
    );

    await act(async () => {
      await expect(result.current.processAudio(blob, 'free')).rejects.toThrow(
        'Audio processing failed'
      );
    });

    expect(mockSetCurrentState).toHaveBeenCalledWith('idle');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd apps/web && pnpm test 2>&1 | tail -20
```

Expected: all tests pass. The new `useAudioProcessing` tests may be complex to fully pass due to Web Audio mocking — adjust mocks as needed until green.

- [ ] **Step 3: Fix any TypeScript errors across the whole app**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1
```

Fix any remaining type errors (likely in files that still reference `AppPhase` as including `'export'`).

- [ ] **Step 4: Commit all changes**

```bash
git add \
  packages/convex/convex/schema.ts \
  packages/convex/convex/sessions.ts \
  packages/convex/convex/crons.ts \
  apps/web/src/lib/store.ts \
  apps/web/src/hooks/useAudioProcessing.ts \
  apps/web/src/app/create/layout.tsx \
  apps/web/src/app/create/page.tsx \
  "apps/web/src/app/create/export/[sessionId]/page.tsx" \
  apps/web/src/__tests__/useAudioProcessing.test.ts

git commit -m "feat: route-based create flow with Convex session storage and tier-based retention"
```

---

## Smoke Test Checklist (manual)

After deploying / running `pnpm dev`:

- [ ] `/create` loads — idle state renders, UserButton visible
- [ ] Record audio → waveform shows, URL stays `/create`
- [ ] Stop recording → processing spinner, URL stays `/create`
- [ ] Processing completes → browser navigates to `/create/export/[sessionId]`
- [ ] Export screen loads — audio plays, waveform renders
- [ ] Expiry notice shows correct duration (free = "Expires in Xh", creator = "Saved for X days")
- [ ] Download works
- [ ] "New recording" → navigates to `/create`, export screen unmounts
- [ ] Browser back from export → `/create` (idle), no phantom routes in history
- [ ] Open `/create/export/[sessionId]` in a new tab → audio hydrates from Convex, export works
- [ ] Hard refresh on `/create/export/[sessionId]` → audio reloads from Convex
- [ ] Paste a fake/expired sessionId → redirected to `/create` with toast
