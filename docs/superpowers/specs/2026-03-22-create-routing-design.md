# Create Route Routing Architecture Design

> **For agentic workers:** This spec was produced via brainstorming. Use `superpowers:writing-plans` to generate the implementation plan before touching code.

**Goal:** Replace the single monolithic `/create` page (4-phase Zustand state machine) with a proper Next.js App Router routing structure that gives the export phase its own URL, backed by Convex temporary storage with tier-based retention.

---

## Background

The current `/create` page is a single client component (~278 lines) that conditionally renders four full-screen phases (`IdleState`, `RecordingState`, `ProcessingState`, `ExportState`) based on a Zustand `AppPhase` state machine. All audio data lives in-memory (Zustand, not persisted). This means:

- No deep-linking to export sessions
- Hard refresh loses everything
- No session recovery
- No sharing

---

## Routes

```
app/create/
  layout.tsx                   ← shared chrome for all /create/* routes
  page.tsx                     ← idle + recording + processing phases
  export/
    [sessionId]/
      page.tsx                 ← export phase, Convex-backed
```

### URL structure

| Phase | URL | Driven by |
|---|---|---|
| Idle | `/create` | Zustand `currentState = 'idle'` |
| Recording | `/create` | Zustand `currentState = 'recording'` |
| Processing | `/create` | Zustand `currentState = 'processing'` |
| Export | `/create/export/[sessionId]` | Convex session document |

Recording and processing have no URL change. They are ephemeral transitions — non-bookmarkable, non-shareable by design. Only export represents durable user state.

---

## Convex Data Model

All Convex files live in `packages/convex/convex/`.

### `sessions` table (`packages/convex/convex/schema.ts`)

```ts
sessions: defineTable({
  userId:      v.string(),         // Clerk user ID
  storageId:   v.id('_storage'),   // Convex file storage reference (audio blob)
  mimeType:    v.string(),         // e.g. "audio/webm", "audio/mp4"
  durationSec: v.number(),         // audio duration in seconds
  transcript:  v.array(v.object({  // Word[] from Whisper
    text:  v.string(),
    start: v.number(),
    end:   v.number(),
  })),
  tier:        v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
  // Note: 'pro' maps to creator-level retention (30 days)
  expiresAt:   v.number(),         // Unix timestamp (ms)
  createdAt:   v.number(),         // Unix timestamp (ms)
}),
```

### Retention policy

| Tier | Retention |
|---|---|
| Free | 24 hours |
| Creator | 30 days |

`expiresAt` is computed at session creation time based on the user's tier at that moment (snapshot — does not change if the user upgrades later).

### Cleanup

A Convex scheduled function (`packages/convex/convex/sessions.ts`) runs periodically to delete expired sessions:
1. Query sessions where `expiresAt < Date.now()`
2. `ctx.storage.delete(session.storageId)` — removes audio file
3. `ctx.db.delete(session._id)` — removes session document

---

## Processing Pipeline (Updated)

### `useAudioProcessing` interface change

`processAudio` currently returns `Promise<void>` and internally calls `setCurrentState('export')`. This changes:

```ts
// OLD
processAudio(blob: Blob): Promise<void>

// NEW
processAudio(blob: Blob, tier: UserTier): Promise<string>  // returns sessionId
```

The internal `setCurrentState('export')` call is **removed** from `useAudioProcessing`. Navigation is the caller's responsibility.

`tier` is passed in from the caller (`page.tsx`) where `useCurrentUser()` is already called. This avoids reading a React hook value inside an async callback.

### Pipeline steps

When `processAudio(blob, tier)` is called:

```
1. Decode audio blob → AudioBuffer (client, existing)
2. Zustand: setCurrentState('processing')
3. In parallel:
   a. Upload audio blob to Convex storage (two-step):
        i.  Call Convex mutation `generateUploadUrl()` → one-time POST URL
        ii. fetch(uploadUrl, { method: 'POST', body: blob }) → { storageId }
   b. Send audio to Whisper API → transcript (Word[])
4. When both complete:
   a. Call Convex mutation `createSession({ storageId, transcript, mimeType,
      durationSec, tier })` → sessionId
5. Return sessionId to caller
```

### Caller (`page.tsx`) handles navigation

```ts
const { processingProgress, processAudio } = useAudioProcessing(transcription);
const { tier } = useCurrentUser();

const handleProceed = useCallback(async () => {
  if (!recorder.audioBlob) return;
  try {
    const sessionId = await processAudio(recorder.audioBlob, tier);
    router.push(`/create/export/${sessionId}`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Processing failed');
  }
}, [recorder.audioBlob, processAudio, tier, router]);
```

---

## layout.tsx — Shared Chrome

Extracted from the current `CreateContent` component. Renders for all `/create/*` routes.

**Responsibilities:**
- `<AuthGate>` — redirects unauthenticated users
- `<CapabilityBanner>` — browser capability warnings
- `<UserButton>` — visible in idle and export phases
- `<UpgradeSheet>` — shared modal, single instance
- `useCheckout` + `usePaymentRedirect` — lifted here so they work across both routes
- `<OnboardingDialog>` — first-time dialog overlay
- Branded `ordio` watermark
- `aria-live` phase announcer (idle/recording/processing only; export has its own)

---

## page.tsx — Idle / Recording / Processing

Handles the three ephemeral phases. Zustand `currentState` drives which component renders.

**Responsibilities:**
- `<IdleState>` — record button, file upload
- `<RecordingState>` — waveform visualiser, pause/resume/stop
- `<ProcessingState>` — Whisper + upload progress spinner
- On processing complete: receives `sessionId` from `processAudio`, calls `router.push('/create/export/[sessionId]')`
- On cancel/reset: `reset()` → stay on `/create`

No URL changes during these phases. The `aria-live` announcer covers recording and processing only.

---

## export/[sessionId]/page.tsx — Export

### Guard behaviour

```
Session found + not expired  → render ExportState
Session not found            → redirect('/create') + toast "Recording not found"
Session expired              → redirect('/create') + toast "Recording expired. Start a new one."
Loading                      → render skeleton/spinner
```

The guard uses a Convex `useQuery(api.sessions.getSession, { sessionId })` call. The result drives the conditional render.

### Audio hydration on direct navigation

When a user arrives via bookmark or direct URL (no in-memory Zustand state), the export page must reconstruct the data:

1. **Transcript** — loaded directly from the Convex session document (`session.transcript`)
2. **AudioBuffer** — requires fetching and decoding:
   - Call Convex query `getAudioUrl({ storageId })` → `ctx.storage.getUrl(storageId)` → signed URL
   - `fetch(audioUrl)` → `arrayBuffer` → `audioContext.decodeAudioData()` → `AudioBuffer`
   - Store result in Zustand via `setAudioBuffer`
   - Show loading state during this fetch+decode (~1–3s for typical files)

**Loading sequence:**
```
Page mounts → Convex query loading → skeleton
Convex returns session → fetch audio URL → decode → setAudioBuffer
AudioBuffer ready → render ExportState
```

When arriving from the processing pipeline (normal flow), `audioBuffer` and `transcript` are already in Zustand — the hydration step is skipped (audioBuffer is not null).

### Expiry notice

The export screen shows a visible expiry indicator:
- Free: "Expires in Xh Ym" (urgency — drives exports and upgrades)
- Creator: "Saved until [date]" (reassurance)

Computed from `session.expiresAt`.

### "New recording" action

`router.push('/create')` + `reset()`. Does not delete the Convex session — user may return within their retention window.

### Back button

Browser back from `/create/export/[sessionId]` → `/create`. Zustand `currentState` is `'idle'` — clean entry point.

---

## AppPhase — `'export'` Removed

`store.ts` currently defines:
```ts
export type AppPhase = 'idle' | 'recording' | 'processing' | 'export';
```

After this change, `'export'` is no longer a valid phase — export has its own URL. The union becomes:
```ts
export type AppPhase = 'idle' | 'recording' | 'processing';
```

Consequences:
- `setCurrentState('export')` in `useAudioProcessing` is removed (replaced by returning `sessionId`)
- `currentState === 'export'` checks in `page.tsx` are removed
- The `aria-live` `{currentState === 'export' && 'Export ready'}` entry is removed from `page.tsx`
- The `ExportState` conditional in `page.tsx` is removed entirely

---

## Navigation Flow

```
/create (idle)
  ├── user starts recording
  │     └── Zustand: currentState = 'recording' (URL stays /create)
  ├── user stops recording
  │     └── Zustand: currentState = 'processing' (URL stays /create)
  ├── processAudio(blob, tier) completes
  │     └── returns sessionId
  │     └── router.push('/create/export/abc123')
  │
  └── user uploads a file
        └── processAudio(file, tier) → same pipeline

/create/export/abc123
  ├── user downloads video → stays on page
  ├── user clicks "New recording" → reset() + router.push('/create')
  └── user presses back → /create (idle)

Direct navigation to /create/export/abc123
  └── Convex query: valid + not expired → hydrate audio → render ExportState
  └── Convex query: expired → redirect /create + toast
  └── Convex query: not found → redirect /create + toast
```

---

## Back Button Semantics

`router.push` is used for the processing→export transition:

```
Browser history after normal flow:
  [/create, /create/export/abc123]

Back from export:     → /create (idle) ✓
Forward to export:    → /create/export/abc123 → guard passes → ExportState ✓
```

---

## Error States

| Scenario | Behaviour |
|---|---|
| Convex upload fails during processing | Toast error, stay on `/create`, user can retry |
| Whisper fails | Toast error (existing behaviour), stay on `/create` |
| Session expired mid-export | Convex reactive query updates → toast + `router.push('/create')` |
| Audio fetch fails during hydration | Toast error on export page, "Reload" button |

---

## Tier-Aware Behaviour

`tier` is captured at session creation time. A free user who upgrades after recording retains their 24h session. Extending `expiresAt` on upgrade is out of scope for this change.

---

## Files Changed

| File | Action |
|---|---|
| `app/create/layout.tsx` | **Create** — shared chrome (AuthGate, UserButton, CapabilityBanner, UpgradeSheet, useCheckout, usePaymentRedirect, OnboardingDialog, watermark) |
| `app/create/page.tsx` | **Modify** — remove export branch + `'export'` phase; add `router.push` on processAudio completion; pass `tier` to `processAudio` |
| `app/create/export/[sessionId]/page.tsx` | **Create** — Convex guard, audio hydration, ExportState render, expiry notice |
| `apps/web/src/hooks/useAudioProcessing.ts` | **Modify** — accept `tier` param; return `Promise<string>` (sessionId); remove internal `setCurrentState('export')`; add parallel Convex upload |
| `apps/web/src/components/soul/ExportState.tsx` | **Modify** — accept `sessionId` prop; show expiry notice from session data |
| `packages/convex/convex/schema.ts` | **Modify** — add `sessions` table |
| `packages/convex/convex/sessions.ts` | **Create** — `createSession` mutation, `getSession` query, `getAudioUrl` query, scheduled cleanup function |
| `apps/web/src/lib/store.ts` | **Modify** — remove `'export'` from `AppPhase` union |

---

## Out of Scope

- Project library / "My recordings" page — future feature
- Extending `expiresAt` on tier upgrade — future product decision
- Sharing sessions with other users — future feature
- Audio enhancement pipeline changes — separate concern
