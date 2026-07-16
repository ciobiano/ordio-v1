# Resilient Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover a user's recording after a crash/tab-close at any point from recording-start through session-created (via periodic + stop + pause IndexedDB autosave), and surface two previously-silent failure paths — the canvas preview's RAF render loop, and (as a small label polish only) the export retry button.

**Architecture:** A single new persistence module (`recordingDraft.ts`, wrapping `idb-keyval`) is written to from three points in the existing recording lifecycle (periodic timer, pause, stop) and cleared from two (processing success, explicit reset). A new `useRecordingRecovery` hook checks for a leftover draft once per app load and offers Resume/Discard via a Sonner toast. Separately and independently, `CanvasPreview.tsx`'s render loop gets a try/catch it currently lacks, and the export header button gets a one-line label change.

**Tech Stack:** Next.js 15, React, Zustand, `idb-keyval` (new), Sonner (existing), Vitest + `@testing-library/react` + `fake-indexeddb` (new, dev-only).

## Global Constraints

- Client-side only — no server-render infrastructure (per spec Constraints).
- Follow the existing `AudioProcessingError`-style typed-error idiom, not a new generic `AppError` class (per spec Constraints).
- Reuse Sonner (`toast(...)`) for all new user-facing notifications — no new notification mechanism (per spec Constraints).
- This branch (`feature/resilient-data-safety`) is based on `main`. `CanvasPreview.tsx` still has `drawCurrentFrame` inline (no `useCanvasRenderLoop.ts` hook split exists on this branch) — Task 5 modifies `CanvasPreview.tsx` directly (per spec Constraints).
- File uploads never write an autosave draft — only live recordings do (per spec Constraints).
- No TTL/expiry logic for the draft in this plan — clear-on-success and clear-on-discard are the only removal paths (per spec Premise 4).

---

### Task 1: `recordingDraft.ts` persistence module

**Files:**
- Modify: `apps/web/package.json` (add `idb-keyval` dependency, `fake-indexeddb` dev dependency)
- Create: `apps/web/src/lib/persistence/recordingDraft.ts`
- Test: `apps/web/src/__tests__/recordingDraft.test.ts`

**Interfaces:**
- Produces: `saveRecordingDraft(blob: Blob, meta: { mimeType: string; durationSec: number }): Promise<void>`, `getRecordingDraft(): Promise<RecordingDraft | null>`, `clearRecordingDraft(): Promise<void>`, and the `RecordingDraft` interface (`{ blob: Blob; mimeType: string; durationSec: number; savedAt: number }`) — all consumed by Tasks 2, 3, and 4.

- [ ] **Step 1: Add dependencies**

Edit `apps/web/package.json`. In `"dependencies"`, add a line after `"framer-motion": "^12.36.0",`:

```json
    "idb-keyval": "^6.3.0",
```

In `"devDependencies"`, add a line after `"@testing-library/react": "^16.3.2",`:

```json
    "fake-indexeddb": "^6.2.5",
```

Run: `cd apps/web && pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/__tests__/recordingDraft.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { saveRecordingDraft, getRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

describe('lib/persistence: recordingDraft', () => {
  it('returns null when no draft has been saved', async () => {
    const draft = await getRecordingDraft();
    expect(draft).toBeNull();
  });

  it('round-trips a saved draft', async () => {
    const blob = new Blob(['test-audio'], { type: 'audio/webm' });
    await saveRecordingDraft(blob, { mimeType: 'audio/webm', durationSec: 12.5 });

    const draft = await getRecordingDraft();
    expect(draft).not.toBeNull();
    expect(draft?.mimeType).toBe('audio/webm');
    expect(draft?.durationSec).toBe(12.5);
    expect(draft?.blob).toBeInstanceOf(Blob);
    expect(draft?.savedAt).toBeGreaterThan(0);
  });

  it('overwrites a previous draft on save', async () => {
    await saveRecordingDraft(new Blob(['first']), { mimeType: 'audio/webm', durationSec: 5 });
    await saveRecordingDraft(new Blob(['second']), { mimeType: 'audio/webm', durationSec: 8 });

    const draft = await getRecordingDraft();
    expect(draft?.durationSec).toBe(8);
  });

  it('clears a saved draft', async () => {
    await saveRecordingDraft(new Blob(['test']), { mimeType: 'audio/webm', durationSec: 3 });
    await clearRecordingDraft();

    const draft = await getRecordingDraft();
    expect(draft).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/recordingDraft.test.ts`
Expected: FAIL — `Cannot find module '@/lib/persistence/recordingDraft'`

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/lib/persistence/recordingDraft.ts`:

```typescript
import { get, set, del } from 'idb-keyval';

const DRAFT_KEY = 'ordio:recording-draft';

export interface RecordingDraft {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  savedAt: number;
}

export async function saveRecordingDraft(
  blob: Blob,
  meta: { mimeType: string; durationSec: number }
): Promise<void> {
  const draft: RecordingDraft = {
    blob,
    mimeType: meta.mimeType,
    durationSec: meta.durationSec,
    savedAt: Date.now(),
  };
  await set(DRAFT_KEY, draft);
}

export async function getRecordingDraft(): Promise<RecordingDraft | null> {
  const draft = await get<RecordingDraft>(DRAFT_KEY);
  return draft ?? null;
}

export async function clearRecordingDraft(): Promise<void> {
  await del(DRAFT_KEY);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/recordingDraft.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/persistence/recordingDraft.ts apps/web/src/__tests__/recordingDraft.test.ts
git commit -m "feat(persistence): add recordingDraft IndexedDB save/get/clear module"
```

---

### Task 2: Periodic + pause + stop autosave in `useAudioRecorder`

**Files:**
- Modify: `apps/web/src/hooks/audio/useAudioRecorder.ts`
- Test: `apps/web/src/__tests__/useAudioRecorder.test.ts` (create — no existing test file for this hook)

**Interfaces:**
- Consumes: `saveRecordingDraft`, `clearRecordingDraft` from Task 1 (`@/lib/persistence/recordingDraft`).
- Produces: no change to `UseAudioRecorderReturn`'s public shape — this task only adds internal side effects, so nothing downstream needs new types.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/useAudioRecorder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import * as recordingDraft from '@/lib/persistence/recordingDraft';

vi.mock('@/lib/persistence/recordingDraft', () => ({
  saveRecordingDraft: vi.fn().mockResolvedValue(undefined),
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
}));

describe('hooks/audio: useAudioRecorder autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists a draft periodically while recording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const recorderInstance = (window.MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    act(() => {
      recorderInstance.ondataavailable({ data: new Blob(['chunk']), size: 5 } as unknown as BlobEvent);
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(recordingDraft.saveRecordingDraft).toHaveBeenCalled();
  });

  it('persists a draft immediately on stop', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const recorderInstance = (window.MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    act(() => {
      recorderInstance.ondataavailable({ data: new Blob(['chunk']), size: 5 } as unknown as BlobEvent);
    });

    vi.clearAllMocks();

    act(() => {
      result.current.stopRecording();
      recorderInstance.onstop();
    });

    expect(recordingDraft.saveRecordingDraft).toHaveBeenCalledTimes(1);
  });

  it('clears the draft on resetRecording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    act(() => {
      result.current.resetRecording();
    });

    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/useAudioRecorder.test.ts`
Expected: FAIL — `saveRecordingDraft`/`clearRecordingDraft` not called (autosave doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Replace the full contents of `apps/web/src/hooks/audio/useAudioRecorder.ts`:

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { saveRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

const RECORDING_DRAFT_SAVE_INTERVAL_MS = 5000;

interface UseAudioRecorderOptions {
  streamTransformer?: (raw: MediaStream) => Promise<MediaStream>;
}

interface UseAudioRecorderReturn {
  state: RecorderState;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<MediaStream | undefined>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(
  options?: UseAudioRecorderOptions
): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDraftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
  }, [clearTimer]);

  const clearSaveDraftTimer = useCallback(() => {
    if (saveDraftTimerRef.current) {
      clearInterval(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    const durationSec = (Date.now() - recordingStartRef.current) / 1000;
    void saveRecordingDraft(blob, { mimeType: mimeTypeRef.current, durationSec });
  }, []);

  const startSaveDraftTimer = useCallback(() => {
    clearSaveDraftTimer();
    saveDraftTimerRef.current = setInterval(persistDraftNow, RECORDING_DRAFT_SAVE_INTERVAL_MS);
  }, [clearSaveDraftTimer, persistDraftNow]);

  const startRecording = useCallback(async (): Promise<MediaStream | undefined> => {
    try {
      setError(null);
      chunksRef.current = [];

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: { ideal: true },
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
        },
      });
      rawStreamRef.current = rawStream;

      // Apply enhancement pipeline if provided
      const stream = options?.streamTransformer
        ? await options.streamTransformer(rawStream)
        : rawStream;
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      const mimeType = recorder.mimeType || 'audio/webm';
      recorderRef.current = recorder;
      mimeTypeRef.current = mimeType;
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setState('stopped');
        clearTimer();
        clearSaveDraftTimer();
        const durationSec = (Date.now() - recordingStartRef.current) / 1000;
        void saveRecordingDraft(blob, { mimeType, durationSec });
      };

      recorder.start(100); // Collect data every 100ms
      setState('recording');
      setRecordingTime(0);
      startTimer();
      startSaveDraftTimer();

      return stream;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      return undefined;
    }
  }, [startTimer, clearTimer, startSaveDraftTimer, clearSaveDraftTimer, options]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    // Stop both raw mic tracks and any enhanced stream tracks
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearTimer();
  }, [clearTimer]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setState('paused');
      clearTimer();
      persistDraftNow();
      clearSaveDraftTimer();
    }
  }, [clearTimer, persistDraftNow, clearSaveDraftTimer]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setState('recording');
      startTimer();
      startSaveDraftTimer();
    }
  }, [startTimer, startSaveDraftTimer]);

  const resetRecording = useCallback(() => {
    stopRecording();
    clearSaveDraftTimer();
    setState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
    void clearRecordingDraft();
  }, [stopRecording, clearSaveDraftTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rawStreamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      clearTimer();
      clearSaveDraftTimer();
    };
  }, [clearTimer, clearSaveDraftTimer]);

  return {
    state,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/useAudioRecorder.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Run the full existing test suite to check for regressions**

Run: `cd apps/web && pnpm test`
Expected: all previously-passing tests still pass (this hook has no prior dedicated test file, so check there's no fallout in tests that exercise `useCreateFlow` or capture-flow behavior indirectly).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/audio/useAudioRecorder.ts apps/web/src/__tests__/useAudioRecorder.test.ts
git commit -m "feat(capture): autosave recording draft periodically, on pause, and on stop"
```

---

### Task 3: Clear draft on successful processing in `useAudioProcessing`

**Files:**
- Modify: `apps/web/src/hooks/audio/useAudioProcessing.ts`
- Test: `apps/web/src/__tests__/useAudioProcessing.test.ts` (existing file — add one test)

**Interfaces:**
- Consumes: `clearRecordingDraft` from Task 1.

- [ ] **Step 1: Add the module mock**

In `apps/web/src/__tests__/useAudioProcessing.test.ts`, add this import and `vi.mock` call near the top of the file, directly after the existing `vi.mock('@/lib/media', ...)` block (around line 60):

```typescript
import * as recordingDraft from '@/lib/persistence/recordingDraft';

vi.mock('@/lib/persistence/recordingDraft', () => ({
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 2: Write the failing test**

Add this test inside the existing `describe('useAudioProcessing', ...)` block, directly after the `'returns a string sessionId on success'` test (after line 178):

```typescript
  it('clears the recording draft after a session is created successfully', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock
      .mockReturnValueOnce(mockGenerateUploadUrl)
      .mockReturnValueOnce(mockCreateSession);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await result.current.processAudio(blob);
    });

    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/useAudioProcessing.test.ts`
Expected: FAIL — `clearRecordingDraft` never called.

- [ ] **Step 4: Write the implementation**

In `apps/web/src/hooks/audio/useAudioProcessing.ts`, add the import near the top (alongside the existing imports):

```typescript
import { clearRecordingDraft } from '@/lib/persistence/recordingDraft';
```

Then modify the section after session creation (currently):

```typescript
        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await createSessionRef.current({
          storageId,
          mimeType: blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript: words,
        });

        // Step 5: Finalize
        setProcessingProgress(100);

        return sessionId;
```

to:

```typescript
        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await createSessionRef.current({
          storageId,
          mimeType: blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript: words,
        });

        // Step 5: Finalize
        void clearRecordingDraft();
        setProcessingProgress(100);

        return sessionId;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/useAudioProcessing.test.ts`
Expected: PASS — including the new test and all pre-existing ones in this file.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/audio/useAudioProcessing.ts apps/web/src/__tests__/useAudioProcessing.test.ts
git commit -m "feat(capture): clear recording draft after successful session creation"
```

---

### Task 4: `useRecordingRecovery` hook + wiring into `useCreateFlow`

**Files:**
- Create: `apps/web/src/hooks/recording/useRecordingRecovery.ts`
- Test: `apps/web/src/__tests__/useRecordingRecovery.test.ts`
- Modify: `apps/web/src/hooks/recording/useCreateFlow.ts`

**Interfaces:**
- Consumes: `getRecordingDraft`, `clearRecordingDraft` from Task 1 (`@/lib/persistence/recordingDraft`); `toast` from `'sonner'`.
- Produces: `useRecordingRecovery(onResume: (blob: Blob) => Promise<void>): void` — consumed by `useCreateFlow.ts` in this same task.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/useRecordingRecovery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useRecordingRecovery } from '@/hooks/recording/useRecordingRecovery';
import * as recordingDraft from '@/lib/persistence/recordingDraft';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {}),
}));

vi.mock('@/lib/persistence/recordingDraft', () => ({
  getRecordingDraft: vi.fn(),
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
}));

describe('hooks/recording: useRecordingRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no draft is found', async () => {
    vi.mocked(recordingDraft.getRecordingDraft).mockResolvedValue(null);
    const onResume = vi.fn();

    renderHook(() => useRecordingRecovery(onResume));

    await waitFor(() => {
      expect(recordingDraft.getRecordingDraft).toHaveBeenCalledTimes(1);
    });
    expect(toast).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it('shows a Resume/Discard toast when a draft is found', async () => {
    const draft = {
      blob: new Blob(['test']),
      mimeType: 'audio/webm',
      durationSec: 10,
      savedAt: Date.now(),
    };
    vi.mocked(recordingDraft.getRecordingDraft).mockResolvedValue(draft);
    const onResume = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useRecordingRecovery(onResume));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledTimes(1);
    });

    const [, options] = vi.mocked(toast).mock.calls[0];
    options.action.onClick();
    expect(onResume).toHaveBeenCalledWith(draft.blob);

    options.cancel.onClick();
    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/useRecordingRecovery.test.ts`
Expected: FAIL — `Cannot find module '@/hooks/recording/useRecordingRecovery'`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/hooks/recording/useRecordingRecovery.ts`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

/**
 * Checks once per mount for a leftover autosaved recording (from a crash
 * or closed tab) and offers the user a Resume/Discard choice via toast.
 */
export function useRecordingRecovery(onResume: (blob: Blob) => Promise<void>): void {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    void (async () => {
      const draft = await getRecordingDraft();
      if (!draft) return;

      toast('Unsaved recording found', {
        description: 'We recovered a recording from your last session.',
        duration: Infinity,
        action: {
          label: 'Resume',
          onClick: () => {
            void onResume(draft.blob);
          },
        },
        cancel: {
          label: 'Discard',
          onClick: () => {
            void clearRecordingDraft();
          },
        },
      });
    })();
  }, [onResume]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/useRecordingRecovery.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Wire into `useCreateFlow.ts`**

In `apps/web/src/hooks/recording/useCreateFlow.ts`, add the import near the other hook imports:

```typescript
import { useRecordingRecovery } from '@/hooks/recording/useRecordingRecovery';
```

Add a `handleResumeRecovery` callback near `handleProceed` (same file, same pattern — mirrors `handleProceed`'s body exactly since Resume takes the same recovered-blob-to-session path):

```typescript
  const handleResumeRecovery = useCallback(async (blob: Blob) => {
    setProcessingAlert(null);
    try {
      const sessionId = await processAudio(blob);
      if (!sessionId) return;
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [processAudio, router, handleProcessingFailure]);

  useRecordingRecovery(handleResumeRecovery);
```

Place this directly after the `handleProceed` definition (so it sits next to the function it mirrors).

- [ ] **Step 6: Run the full test suite to check for regressions**

Run: `cd apps/web && pnpm test`
Expected: all tests pass, including the existing `useCreateFlow`-adjacent tests if any exist.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/recording/useRecordingRecovery.ts apps/web/src/__tests__/useRecordingRecovery.test.ts apps/web/src/hooks/recording/useCreateFlow.ts
git commit -m "feat(capture): recover autosaved recording via Resume/Discard toast on load"
```

---

### Task 5: Preview crash surfacing in `CanvasPreview`

**Files:**
- Modify: `apps/web/src/components/primitives/video/CanvasPreview.tsx`
- Test: `apps/web/src/__tests__/CanvasPreview.test.tsx` (create)

**Interfaces:**
- Consumes: `toast` from `'sonner'` (new import in this file).
- No new exports — internal behavior change only.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/CanvasPreview.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { toast } from 'sonner';
import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import { useUIStore, useProcessingStore, useCaptureStore } from '@/stores';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock('@/lib/video', () => ({
  renderFrame: vi.fn().mockImplementation(() => {
    throw new Error('boom');
  }),
}));

vi.mock('@/lib/loaders', () => ({
  loadFont: vi.fn().mockResolvedValue(undefined),
  loadGraphic: vi.fn().mockResolvedValue(undefined),
}));

function buildPlayback() {
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 10,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    previewAt: vi.fn(),
    registerTimeListener: vi.fn().mockReturnValue(() => {}),
  } as unknown as import('@/hooks/playback/usePlayback').UsePlaybackReturn;
}

describe('components/primitives/video: CanvasPreview crash surfacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no real canvas backend — getContext('2d') returns null by
    // default, which would make drawCurrentFrame's early-return fire before
    // ever reaching the try/catch this test exists to exercise. Stub it to
    // return a truthy object; the mocked renderFrame below never actually
    // draws with it, it just needs to not be null.
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({});
    useUIStore.setState({
      style: { width: 1080, height: 1080, backgroundColor: '#000', textColor: '#fff', fontFamily: 'Inter' },
      captionAnimation: 'none',
      captionTransform: { visible: true, scale: 1, rotationDeg: 0, offsetXRatio: 0, offsetYRatio: 0 },
    });
    useProcessingStore.setState({ transcript: [], captionGroups: [] });
    useCaptureStore.setState({ audioBuffer: null });
  });

  it('does not throw when drawCurrentFrame errors, and toasts once', () => {
    expect(() =>
      render(
        <CanvasPreview
          playback={buildPlayback()}
          format="square"
          waveformStyle="bars"
          captionMode="phrase"
        />
      )
    ).not.toThrow();

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/CanvasPreview.test.tsx`
Expected: FAIL — either the render throws uncaught, or `toast.error` is never called (no try/catch exists yet).

- [ ] **Step 3: Write the implementation**

In `apps/web/src/components/primitives/video/CanvasPreview.tsx`:

Add the import near the top, alongside the other imports:

```typescript
import { toast } from 'sonner';
```

Add a ref near the other refs at the top of the component body (alongside `waveformDataRef`, `rafRef`, etc.):

```typescript
  const hasWarnedRenderErrorRef = useRef(false);
```

Wrap the body of `drawCurrentFrame` (everything after the `if (!ctx) return;` guard) in try/catch:

```typescript
  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const duration = playback.duration || 1;
      const totalFrames = Math.ceil(duration * FPS);
      const frameIndex = Math.min(
        Math.floor(currentTimeRef.current * FPS),
        totalFrames - 1
      );

      const renderStyle = { ...style, width: canvasWidth, height: canvasHeight };
      const frameOptions: FrameOptions = {
        waveformData: waveformDataRef.current,
        transcript,
        style: renderStyle,
        waveformStyle,
        captionMode,
        canvasLayout,
        showWatermark,
        graphicStyle,
        captionGroups,
        captionAnimation,
        captionTransform,
      };

      renderFrame(ctx, Math.max(0, frameIndex), totalFrames, frameOptions);
      const hasVisualZone = captionMode !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
      const nextCaptionBox = measureCaptionTransformBox({
        ctx,
        currentTime: currentTimeRef.current,
        transcript,
        captionGroups,
        style: renderStyle,
        layout: canvasLayout ?? 'top',
        hasVisualZone,
        flipped: canvasLayout === 'flipped',
        transform: captionTransform,
        captionMode,
      });
      setCaptionBox((prev) => (areCaptionBoxesEqual(prev, nextCaptionBox) ? prev : nextCaptionBox));
    } catch (err) {
      console.error('[CanvasPreview] render frame failed', err);
      if (!hasWarnedRenderErrorRef.current) {
        hasWarnedRenderErrorRef.current = true;
        toast.error('Preview is temporarily unavailable. Your audio is unaffected.');
      }
      // Intentionally no re-throw and no further drawing this tick — canvas
      // keeps showing the last successfully rendered frame.
    }
  }, [playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionMode, canvasLayout, showWatermark, graphicStyle, captionGroups, captionAnimation, captionTransform, fontLoaded]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/CanvasPreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd apps/web && pnpm test`
Expected: all tests pass, including existing `frameRenderer.test.ts` and any other `CanvasPreview`-adjacent tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/primitives/video/CanvasPreview.tsx apps/web/src/__tests__/CanvasPreview.test.tsx
git commit -m "fix(preview): catch render-loop errors, freeze on last good frame instead of crashing"
```

---

### Task 6: Export retry button label polish

**Files:**
- Modify: `apps/web/src/components/soul/states/ExportState/ExportHeader.tsx`
- Modify: `apps/web/src/components/soul/states/ExportState/index.tsx`
- Test: `apps/web/src/__tests__/ExportHeader.test.tsx` (create)

**Interfaces:**
- Produces: `ExportHeaderProps` gains `exportFailed?: boolean` — consumed by `ExportState/index.tsx` in this same task. No other consumers exist.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/ExportHeader.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportHeader } from '@/components/soul/states/ExportState/ExportHeader';

describe('components/soul/states/ExportState: ExportHeader', () => {
  const baseProps = {
    exportedUrl: null,
    exportDisabled: false,
    onBack: vi.fn(),
    onExport: vi.fn(),
    onDownload: vi.fn(),
  };

  it('shows "Export" by default', () => {
    render(<ExportHeader {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('shows "Retry export" when exportFailed is true', () => {
    render(<ExportHeader {...baseProps} exportFailed />);
    expect(screen.getByRole('button', { name: 'Retry export' })).toBeInTheDocument();
  });

  it('still shows "Download" when exportedUrl is set, regardless of exportFailed', () => {
    render(<ExportHeader {...baseProps} exportedUrl="blob:test" exportFailed />);
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/__tests__/ExportHeader.test.tsx`
Expected: FAIL — "Retry export" text/label never renders (prop doesn't exist yet).

- [ ] **Step 3: Write the implementation**

In `apps/web/src/components/soul/states/ExportState/ExportHeader.tsx`, change the props interface:

```typescript
interface ExportHeaderProps {
  exportedUrl: string | null;
  exportDisabled: boolean;
  exportFailed?: boolean;
  onBack: () => void;
  onExport: () => void;
  onDownload: () => void;
}
```

Update the function signature and the button's label/aria-label:

```typescript
export function ExportHeader({
  exportedUrl,
  exportDisabled,
  exportFailed = false,
  onBack,
  onExport,
  onDownload,
}: ExportHeaderProps) {
  const exportLabel = exportedUrl ? 'Download' : exportFailed ? 'Retry export' : 'Export';

  return (
```

(keep the rest of the JSX identical up to the second `<Button>`, then change it to):

```typescript
      <Button
        type="button"
        variant="ghost"
        size="xl"
        onClick={exportedUrl ? onDownload : onExport}
        disabled={exportDisabled && !exportedUrl}
        aria-label={exportLabel}
        className="text-[17px] font-semibold text-white
                   hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed
                   active:scale-[0.97]"
      >
        {exportLabel}
      </Button>
```

In `apps/web/src/components/soul/states/ExportState/index.tsx`, find the `<ExportHeader ... />` call (around line 174) and add the new prop:

```typescript
      <ExportHeader
        exportedUrl={exporter.exportedUrl}
        exportDisabled={exportDisabled}
        exportFailed={!!exporter.error}
        onBack={() => setShowDiscardDialog(true)}
        onExport={handleExport}
        onDownload={onDownload}
      />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/__tests__/ExportHeader.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd apps/web && pnpm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/states/ExportState/ExportHeader.tsx apps/web/src/components/soul/states/ExportState/index.tsx apps/web/src/__tests__/ExportHeader.test.tsx
git commit -m "fix(export): relabel export button 'Retry export' after a failed attempt"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full type-check**

Run: `pnpm run type-check`
Expected: clean, no errors across all packages.

- [ ] **Step 2: Run full lint**

Run: `pnpm run lint`
Expected: clean, no errors.

- [ ] **Step 3: Run full test suite**

Run: `pnpm run test`
Expected: all tests pass (pre-existing suite plus the ~13 new tests added across Tasks 1, 2, 4, 5, 6).

- [ ] **Step 4: On-device QA (per spec's accepted no-jsdom-coverage limitation)**

Manually verify, using the running dev server:
- Start a recording, wait >5s, force-close the tab, reload, confirm the Resume/Discard toast appears and Resume goes straight into processing with the recovered audio.
- Stop a recording (don't proceed), force-close the tab, reload, confirm recovery works the same way.
- Trigger a preview render error (e.g., temporarily throw inside `renderFrame` via a dev-only edit, or observe via browser DevTools breakpoint) and confirm the canvas freezes on the last good frame instead of crashing, with exactly one toast.
- Force an export failure (e.g., revoke the canvas mid-export) and confirm the header button reads "Retry export" and clicking it re-attempts successfully.

- [ ] **Step 5: Final commit (if any QA fixes were needed)**

If on-device QA surfaces any issues, fix them with their own atomic commit(s) before considering this plan complete. If QA passes clean, no additional commit is needed here.
