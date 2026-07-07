# Unified Capture Screen — Design Spec

## Source

Claude Design mockup: "Unified Capture.dc.html" (project `867fe69b-4c40-4a13-8a78-e56f41c44395`,
"Unified capture screen"). Mobile-locked prototype (max-width 440px) that renders the
idle → recording → paused → ready → processing sequence as one persistent screen with a
morphing header, orb, and bottom dock. The Export state is out of scope — it has already
been redesigned separately.

## Problem

`apps/web/src/app/create/page.tsx` currently swaps three independently-mounted components
(`IdleState`, `RecordingState`, `ProcessingState`) via `AnimatePresence mode="wait"`. Each
transition unmounts the old component and mounts the new one with a crossfade. The mockup's
signature feel — the orb resizing/relocating in place, the header fading, the dock morphing
button-by-button — requires the same DOM nodes to persist across phase changes instead of a
full remount. This spec covers rebuilding the create-flow shell as one persistent component
with phase-driven morphing, while reusing all existing business logic untouched.

## Non-goals

- Redesigning the `Orb` / `OrbFluidCanvas` visual (gradient, geometry, shader). Kept as-is;
  only its size/position per phase changes.
- Reworking `useCreateFlow`, `useAudioRecorder`, `useAudioProcessing`, `useTranscription`, or
  any other hook's internal logic.
- An app-wide icon sweep. `griddy-icons` is adopted only within the new Capture screen family
  (header, dock, settings sheet, upload sheet, recordings drawer). Other inline SVGs elsewhere
  in the app are untouched — a separate follow-up if wanted later.
- Desktop-specific layout. `/create` is already single-column/mobile-first at all viewports;
  the new design becomes the layout everywhere, capped/centered on wide screens the same way
  the current layout is.

## Phase model

The mockup's five visual phases map onto existing state without adding new top-level app state:

| Mockup phase | Derived from |
|---|---|
| `idle` | `flow.currentState === 'idle'` |
| `recording` | `flow.currentState === 'recording'`, local `RecordingPhase === 'recording'`, `!isPaused` |
| `paused` | `flow.currentState === 'recording'`, local `RecordingPhase === 'recording'`, `isPaused` |
| `ready` | `flow.currentState === 'recording'`, local `RecordingPhase === 'stopped'` |
| `processing` | `flow.currentState === 'processing'` |

`RecordingPhase` (`'recording' | 'stopped'`) already exists in
`soul/recording/state/types.ts` and is currently local to `RecordingState`. It moves up into
`CaptureScreen` alongside `recorder.isPaused` to compute the single `phase` value that drives
every sub-component below.

## Component architecture

New directory: `apps/web/src/components/soul/capture/`

- **`CaptureScreen.tsx`** — replaces the `AnimatePresence` block in `create/page.tsx`. Owns
  the derived `phase` value and passes it down. Single persistent mount for the lifetime of
  the create flow (idle through processing); still unmounts on navigation to
  `/create/export/[sessionId]`.
- **`CaptureHeader.tsx`** — left nav button (hamburger when idle, opens `SavedAudioPanel`
  drawer; back/cancel arrow otherwise, triggers `handleReset`) + avatar (visible/idle only,
  existing `UserAvatarButton`). Fades via CVA variants keyed on `phase`.
- **`CaptureStage.tsx`** — houses the existing `Orb` component and the status text region.
  Only the orb's size and vertical position are animated per phase (CSS custom properties +
  Framer Motion `animate`), matching the mockup's proportions: idle 216px → recording/paused
  200px → ready 196px → processing 128px.

  **Status text is audio-reactive, not just phase-reactive.** The mockup's own prototype
  script only distinguishes "quiet" vs "not quiet" via a single boolean, but the source design
  screenshots name a third, distinct state (`recording-too-quiet` vs `recording-voice-detected`)
  that the interactive prototype doesn't fully encode. The real app already has the correct
  granularity in `soul/recording/state/utils.ts`'s `getQualityBadge` — reuse those same
  thresholds for the status line instead of inventing new ones:

  | Condition | Status text |
  |---|---|
  | `phase === 'idle'` | Idle typewriter placeholder ("Press and hold to record" / "speak your truth") |
  | `phase === 'paused'` | "Paused" |
  | `phase === 'recording'` and `audioLevel < 0.08` | "Too quiet" — mic isn't picking up voice; no live transcript shown even if `isSpeaking` was true a moment ago, so stale transcript text never lingers on screen |
  | `phase === 'recording'` and `audioLevel >= 0.08` and `!isSpeaking` | "Listening" |
  | `phase === 'recording'` and `isSpeaking` | Mocked live caption (see below) |
  | `phase === 'ready'` | "Ready to process" |

  `isSpeaking` here is the real VAD signal from `useVAD`/`useCreateFlow`, not the mockup's
  amplitude-threshold approximation.

  **Live caption is mocked for now, real streaming transcription is future work.** This
  codebase has no live/streaming transcription source today — `useTranscription.transcribeAudio`
  only runs once, after the full recording finishes (Whisper API, batch). Per user direction,
  the "voice detected" branch keeps the mockup's word-by-word caption *behavior* (cycling
  placeholder phrases as if transcribed live) as a visual mock, not real transcription, so the
  UI/animation is ready before the real data source exists. Implementation: reuse the mockup's
  own phrase-cycling logic (`captionPhrases`, word-by-word reveal on a fixed interval) inside
  `CaptureStage`, clearly isolated behind a `useMockLiveCaption(isSpeaking)` hook so swapping in
  real streaming transcription later means replacing that one hook, not touching phase/status
  wiring. Tracked as a follow-up in `TODOS.md`: "Real-time live captioning during recording"
  (Web Speech API interim results, or streaming Whisper) to replace the mock. The moment
  `audioLevel` drops below the threshold or `isSpeaking` goes false, the status line switches
  back to "Too quiet"/"Listening" immediately and the mock caption resets — no stale fragment
  lingers.
- **`CaptureDock.tsx`** — bottom control row. Renders the idle layout (upload pill +
  press-and-hold record button + settings button) or the recording-family layout (left slot:
  settings/stop, center slot: waveform / "Process recording" / progress bar, mid button:
  pause/resume/restart, cancel button), switching content by `phase` while keeping the same
  flex container mounted (so button entrances/exits animate rather than jump-cut).
- **`UploadActionSheet.tsx`** — new Base UI `Dialog`-based action sheet (Photo Library / Take
  Video / Choose File / Cancel). Wraps the existing hidden `<input type="file">` and
  `flow.handleFileSelect` in `useCreateFlow`; "Photo Library"/"Take Video" set the input's
  `accept`/`capture` attributes before triggering it, "Choose File" triggers it directly. No
  new file-handling logic.

Reused as-is, restyled at the call site only:
- **`RecordingSettingsSheet`** — internal state/logic unchanged; its outer sheet shell is
  rebuilt on `@base-ui/react`'s `Dialog` (already a project dependency) so spacing and corner
  radius come from Base UI's scale rather than the mockup's hardcoded pixel values.
- **`SavedAudioPanel`** ("Your recordings" drawer) — same, shell rebuilt on Base UI `Dialog`
  anchored to the left edge, logic untouched.

## Icons

Add `griddy-icons` (npm, MIT, zero deps, verified real package) as a dependency. Every icon
inside the new `capture/` component family, plus `UploadActionSheet`, `RecordingSettingsSheet`,
and `SavedAudioPanel`'s shells, uses `griddy-icons` components instead of hand-rolled inline
SVG. Existing hand-rolled SVGs elsewhere in the app (e.g. `ShareCard`, `StyleModeSelector`,
`OrdioMark`) are untouched.

## Styling

- No inline style props — all variants defined in `lib/variants.ts` via CVA, per project rule.
- No arbitrary Tailwind values — phase-dependent sizes (orb diameter, dock height) become CSS
  custom properties set via inline `style` only where CVA can't express a continuously
  animated numeric value (Framer Motion `animate` targets), consistent with how
  `OrbCanvas`/`OrbFluidCanvas` already do this for `--i` intensity.
- Sheet/drawer/dialog spacing and border radius follow `@base-ui/react`'s defaults rather than
  the mockup's literal pixel values.

## Migration and cleanup

1. Build `CaptureScreen` and sub-components alongside the existing `IdleState`/`RecordingState`/
   `ProcessingState` (no deletion yet).
2. Wire `create/page.tsx` to `CaptureScreen`, verified against the existing 58 tests plus new
   phase-derivation tests, and manual QA of every phase transition (idle → recording → paused →
   ready → processing → reset, plus file upload and settings-sheet paths).
3. Delete `IdleState.tsx`, `RecordingState.tsx` and its `state/` folder
   (`RecordingBottomBar.tsx`, `RecordingCenterStatus.tsx`, `RecordingOverlayHeader.tsx`,
   `types.ts`, `utils.ts`), and `ProcessingState.tsx` once `CaptureScreen` covers their
   behavior and QA passes. `RecordingPhase` type moves to `capture/` before the old file is
   removed.

## Testing

- Existing hook-level tests (recorder, transcription, processing) are unaffected — no hook
  logic changes.
- New: unit tests for the phase-derivation function (all five phases, including the
  `paused`/`ready` branches that depend on two combined flags).
- New: `CaptureDock` renders the correct button set for each of the five phases.
- New: status-text derivation tests covering all four recording-phase branches (too quiet /
  listening / voice detected (mock caption) / paused), including the transition back to "Too
  quiet"/"Listening" the instant `audioLevel`/`isSpeaking` drop — no stale status or stale mock
  caption should linger.
- New: `useMockLiveCaption` tests — starts cycling on `isSpeaking: true`, resets/stops on
  `isSpeaking: false`, cleans up its interval on unmount.
- Manual QA pass (per project rule, UI changes are exercised in-browser before sign-off):
  full idle → recording → paused → ready → processing → export happy path, plus cancel/reset
  from each phase, mic-denied state, and file-upload path, on a mobile viewport.

## Open questions / assumptions carried into the plan

- Assumed "Photo Library" and "Take Video" in the upload sheet map to the same file input with
  different `accept`/`capture` attributes rather than distinct native pickers — matches current
  single-input upload flow. Flag if a truly separate camera-capture flow is wanted.
