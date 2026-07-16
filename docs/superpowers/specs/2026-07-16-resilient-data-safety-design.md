# Design: Resilient Data Safety (Roadmap Option 3)

Status: APPROVED
Branch: feature/resilient-data-safety
Repo: ciobiano/ordio-v1
Supersedes: none — implements Option 3 ("Bulletproof Resilience & Data Safety") from `docs/improvements.md`'s 5-item roadmap, chosen over Option 1 (state/media Web Worker migration — store-split half already done) and Option 2 (XState non-blocking queue — not started).

## Problem Statement

`app/error.tsx` already tells users "Your recording is safe — try again" when a route-level render error occurs, but nothing currently backs that promise. The raw recorded audio `Blob` lives only in `useAudioRecorder`'s React state and `useCaptureStore` (a plain, non-persisted Zustand store) from the moment recording stops through the entire decode → enhance → transcribe → upload pipeline in `useAudioProcessing.ts`. A crashed tab, an accidental navigation, or a browser force-quit anywhere in that window loses the user's only copy of their recording, with no recovery path.

Separately, two crash-prone spots in the canvas/WebCodecs pipeline have no user-facing failure handling:
- **Preview:** `CanvasPreview.tsx`'s `drawCurrentFrame`, called every tick from a `requestAnimationFrame` loop, has zero error handling. A thrown exception there is an uncaught runtime error — it does not trip `app/error.tsx` (React error boundaries only catch errors during render/commit, not inside RAF callbacks), so the loop dies silently with no feedback.
- **Export:** `useVideoExporter.ts`'s `startExport` already has a top-level try/catch that sets an `error` state on any `encode()` failure, and `ExportFooter.tsx` already renders it as a visible red alert (line 84-88). The header's "Export" button is also never disabled on error (`exportDisabled = exporter.isExporting || trimmer.isEmpty` in `ExportState/index.tsx`), so clicking it again already re-triggers `startExport` — a working retry path already exists. **Corrected during planning** (verified by tracing `ExportFooter.tsx` and `ExportState/index.tsx`, not just the top-level page): this is not a real functional gap. The only remaining value here is a small clarity polish — relabel the button "Retry export" when `exporter.error` is set, so the retry affordance is explicit instead of implicit.

## Constraints

- Client-side only, consistent with the rest of the pipeline (no server-render infrastructure, per the project's existing cost-discipline decisions).
- Follow the codebase's existing typed-error idiom (`AudioProcessingError` in `useAudioProcessing.ts` — a domain error class with a stage discriminator, caught and mapped to UI state) rather than introducing a new generic `AppError` class. Retrofitting every other error site in the app into one generic class is a larger, unrelated refactor this spec does not carry.
- Reuse Sonner toasts (`toast(...)`), the app-wide notification mechanism already used throughout (`FILE_ERROR_MESSAGES`, `usePaymentRedirect.ts`, etc.) — no new notification system.
- This branch is based on `main`, which does not yet include the `feature/video-backgrounds` branch's `CanvasPreview` hook split (`useCanvasRenderLoop.ts` does not exist on `main` — `drawCurrentFrame` is still inline in `CanvasPreview.tsx`). The preview crash-surfacing integration point is written against `main`'s current layout; if `feature/video-backgrounds` merges first, the same try/catch relocates cleanly into `useCanvasRenderLoop.ts`'s `drawCurrentFrame` with no change in behavior.
- File uploads (`handleFileConfirm` → `processAudio(file)`) are explicitly excluded from autosave — the source file already exists on the user's disk, so persisting a second copy to IndexedDB is redundant.

## Premises

1. The vulnerable window for data loss starts the moment `MediaRecorder.onstop` fires (in `useAudioRecorder.ts`), not when `processAudio` begins — there's a full review-screen dwell time between "recording stopped" and "user hits Proceed" that the original roadmap doc's "the millisecond the mic stops" framing undersold.
2. Preview crashes and export crashes have different blast radii and need different handling: a dead preview is cosmetic (the user's audio is untouched), a dead export silently wastes the user's wait. Preview degrades gracefully (freeze on last good frame); export fails loudly with a retry path.
3. Recovery should put the user in control (a dismissible Resume/Discard prompt), not silently resume or silently discard — matches this app's existing pattern of explicit user actions at every pipeline stage (Proceed, Restart, Discard).
4. No TTL/expiry logic is needed for v1 — a draft only ever exists between "recording stopped" and "session created or explicitly discarded," so raw staleness isn't really possible outside the crash-recovery case itself, where any age is exactly what should be recovered.

## Approaches Considered

### Persistence: `idb-keyval` (CHOSEN)
Tiny (~600B gzipped), promise-based, actively maintained (v6.3.0, published within the last week as of this writing), built by the Workbox author specifically for single/few-key blob-caching use cases like this one. Stores `Blob`s natively via structured clone — no base64 encoding needed. No existing IndexedDB dependency in the repo, so this is a clean, minimal addition.

**Rejected:** raw `indexedDB` API (hand-rolling promise wrappers around a callback API for no benefit here); `idb` or Dexie.js (both built for multi-store/indexed/reactive use cases this app doesn't have — one key, one value, no queries).

### Crash surfacing: domain-specific try/catch at the two call sites (CHOSEN)
Follows the `AudioProcessingError` pattern already established in this codebase — typed errors, caught close to the source, mapped to UI state. Preview: try/catch around the RAF tick's render call (genuinely missing). Export: already fully handled end-to-end (catch, state, visible alert, working retry-via-existing-button) — only a button-label polish remains.

**Rejected:** a global `window.onerror`/`unhandledrejection` listener (too broad to give the per-context preview-vs-export distinction this spec requires, and can't stop the export loop cleanly since it fires after the fact); a new generic `AppError` class app-wide (bigger, unrelated refactor — see Constraints).

## Data Model

New module `apps/web/src/lib/persistence/recordingDraft.ts`, wrapping `idb-keyval`:

```typescript
interface RecordingDraft {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  savedAt: number; // Date.now()
}

function saveRecordingDraft(blob: Blob, meta: { mimeType: string; durationSec: number }): Promise<void>
function getRecordingDraft(): Promise<RecordingDraft | null>
function clearRecordingDraft(): Promise<void>
```

Single IndexedDB key (`ordio:recording-draft`) — only ever one draft at a time, overwritten on each new recording.

## Components

| File | Change |
|---|---|
| `apps/web/src/lib/persistence/recordingDraft.ts` (create) | `idb-keyval` wrapper: save/get/clear |
| `apps/web/src/hooks/audio/useAudioRecorder.ts` (modify) | `recorder.onstop` calls `saveRecordingDraft(blob, {...})` right after `setAudioBlob(blob)`; `resetRecording` calls `clearRecordingDraft()` |
| `apps/web/src/hooks/audio/useAudioProcessing.ts` (modify) | `processAudio` calls `clearRecordingDraft()` after `createSession` resolves |
| `apps/web/src/hooks/recording/useRecordingRecovery.ts` (create) | On mount: `getRecordingDraft()`; if found, Sonner toast with Resume/Discard actions. Resume → `setAudioBlob`/`setAudioBuffer` into `useCaptureStore`, navigate to review screen. Discard → `clearRecordingDraft()` |
| `apps/web/src/components/soul/capture/CaptureScreen.tsx` (modify) | Calls `useRecordingRecovery()` once on mount |
| `apps/web/src/components/primitives/video/CanvasPreview.tsx` (modify) | Wrap `drawCurrentFrame`'s body in try/catch: log once, toast once (ref-guarded dedup), skip `renderFrame()`/`setCaptionBox` for that tick — canvas keeps showing the last successfully drawn frame |
| `apps/web/src/components/soul/states/ExportState/ExportHeader.tsx` (modify) | Polish only (functional retry already works): accept an `exportFailed` prop, render the header button label as "Retry export" instead of "Export" when true |
| `apps/web/src/components/soul/states/ExportState/index.tsx` (modify) | Pass `exportFailed={!!exporter.error}` through to `ExportHeader` |

## Error Handling

- **Recording → draft lifecycle:** save on `onstop`, clear on successful `createSession` or on explicit `resetRecording`/`handleRestart`. Uploaded files never write a draft.
- **Recovery:** `useRecordingRecovery` runs once per `CaptureScreen` mount. Found draft → non-blocking toast, user chooses Resume or Discard. No draft → silent no-op.
- **Preview crash:** caught in `drawCurrentFrame`, logged once (`console.error`), toasted once via a `hasWarnedRef` guard (prevents a persistent per-frame error from firing ~60 toasts/sec), frame skipped, RAF loop continues untouched. Playback, seeking, and export remain available — this is a presentation-only failure.
- **Export crash:** already fully handled (caught in `startExport`, displayed by `ExportFooter`, retriable via the still-enabled header button) — the only change is relabeling that button "Retry export" instead of "Export" when `exporter.error` is set, so the existing retry affordance is explicit.

## Testing

Matches this project's existing accepted pattern for WebCodecs/canvas paths (same as the video-backgrounds slice): unit-testable logic gets unit tests; browser-only failure paths get on-device QA, not jsdom mocks.

- **Unit tests (vitest):** `recordingDraft.ts` save/get/clear round-trip (via `fake-indexeddb`, added as a dev dependency); `useRecordingRecovery`'s found-draft vs. no-draft branches (mocked draft module); the preview error-guard's dedup logic (inject the same error twice, assert exactly one toast fires).
- **No jsdom coverage** (accepted limitation): the actual RAF-loop crash path needs on-device QA — force a preview render error and confirm freeze-not-crash behavior.
- **`ExportHeader` label test:** straightforward unit test (renders "Export" vs "Retry export" based on an `exportFailed` prop) — no on-device QA needed since it's pure prop-driven rendering, not a WebCodecs path.
- **Regression check:** existing `useVideoExporter.test.ts` and `frameRenderer.test.ts` should not need changes — this design only adds a catch path around the preview loop and a label prop around existing export logic, not a change to any happy path.

## Open Questions

- Whether to add a storage-quota guard around `saveRecordingDraft` (extremely unlikely to matter for a single audio Blob under typical browser IndexedDB quotas, but not verified here) — treat as a follow-up if it ever surfaces in the wild, not a blocker for this slice.
- Whether `useRecordingRecovery`'s Resume path should also restore `useProcessingStore` state (enhance tier, etc.) or just the raw blob and let the user re-choose — default to raw-blob-only (simpler, matches "review screen" starting state) unless real usage shows otherwise.

## Success Criteria

- A user whose tab crashes or is force-closed after stopping a recording, at any point before the session is created, sees a Resume/Discard prompt on their next visit and can recover the full-quality original recording.
- A user who explicitly restarts or completes a recording never sees a stale recovery prompt (draft is cleared on both paths).
- A user who uploads a file (not a live recording) never triggers autosave — no redundant storage writes.
- A crash inside the live canvas preview freezes the visual output without breaking playback, seeking, or the ability to export.
- A failed export's header button reads "Retry export" instead of "Export," making the already-working retry path explicit rather than implicit.
