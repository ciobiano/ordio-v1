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

## Fidelity correction — real screenshots vs. the interactive mockup

Partway through implementation, the user provided a zip of screenshots of the actual deployed
`.dc.html` prototype (the Claude Design "renderer" preview, not just its abstract state-machine
source). These reveal that the interactive mockup's own JS simplified several details for demo
speed, and the *real* target content differs from a literal reading of the `.dc.html` source:

- **Idle has no upload-pill/record/settings dock row.** The deployed reference shows only the
  orb, idle status text, and a small "or upload audio or video" text link below it — matching
  the *original* `IdleState.tsx`, not the mockup's redesigned three-button dock row. The
  existing `SavedAudioPanel` FAB and `UserAvatarButton` stay exactly where they already are.
- **Recording/paused status is a MIC level bar + colored quality badge, not plain text.** The
  deployed reference shows a labeled "MIC" bar plus a colored pill ("Too quiet" amber, "Voice
  detected" emerald, "Listening" sky, "Paused" amber) — this is `getQualityBadge` from
  `soul/recording/state/utils.ts`, already built and already correct. `CaptureStage` calls it
  directly instead of inventing new copy/colors.
- **The recording/paused dock is a 3-icon pill row** (pause/resume, stop, settings), and the
  **ready dock is a full-width "Process recording" button with a Resume · Restart · Cancel
  text-link row below it** — both ported verbatim from the existing `RecordingBottomBar`, not
  the mockup's icon-only 4-button row.
- **Processing has no orb.** The deployed reference matches `ProcessingState` exactly: heading,
  `ProgressRing`, step checklist, no orb, no header buttons, no dock. `CaptureStage` renders
  this content directly for the `processing` phase instead of a thin progress bar in the dock.

The mocked live caption (`useMockLiveCaption`) is kept as an *additional* line beneath the
quality badge when voice is detected, per the user's explicit "keep it as a placeholder for
now" direction — it doesn't replace the badge, since the real reference doesn't show a
transcript at all today.

## Component architecture

New directory: `apps/web/src/components/soul/capture/`

- **`CaptureScreen.tsx`** — replaces the `AnimatePresence` block in `create/page.tsx`. Owns
  the derived `phase` value and passes it down. Single persistent mount for the lifetime of
  the create flow (idle through processing); still unmounts on navigation to
  `/create/export/[sessionId]`.
- **`CaptureHeader.tsx`** — **corrected from the original mockup** (see "Fidelity correction"
  below): idle has no left button at all — `SavedAudioPanel` keeps its own independent FAB
  trigger, unchanged. Every other phase shows a plain back arrow (`handleReset`); the avatar
  (`UserAvatarButton`) is idle-only, fading out otherwise.
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
- **`CaptureDock.tsx`** — **corrected from the original mockup.** Renders nothing for `idle`
  (the record trigger is the orb's own press-and-hold, matching the deployed reference; the
  upload entry point is a small text link in `CaptureStage`, not a dock row) and nothing for
  `processing` (its content — ring, checklist, cancel — lives entirely in `CaptureStage`,
  matching `ProcessingState`). For `recording`/`paused`, it's the existing three-icon
  `mobile-glass` pill row ported from `RecordingBottomBar`: pause/resume, stop (destructive,
  goes to `ready`), settings. For `ready`, it's the existing full-width `proceedBtn` "Process
  recording" button plus a text-link row (Resume · Restart · Cancel) below it — also ported
  from `RecordingBottomBar`, not reinvented.
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

## Sheet chrome — ChatGPT iOS Design System

Net-new sheets in this feature (currently: `UploadActionSheet`) follow a second Claude Design
reference the user provided mid-implementation — "ChatGPT iOS Design System" (project
`5e700c08-7046-4937-b24c-72c98641a725`) — rather than improvised styling. Key tokens actually
used: white sheet background (`#FFFFFF`), centered drag handle, sunken-surface list rows
(`#ECECEC`) with a left icon + stacked title (18px/600, `#0D0D0D`) + subtitle (15px,
`#8E8E93`), hairline dividers, and 28px-ish sheet-top radius (approximated with Tailwind's
`rounded-t-3xl` to stay within the app's existing radius scale rather than a one-off value).
This is a light sheet on the Capture screen's otherwise all-black stage — confirmed correct
against a second reference image the user pasted showing exactly this pattern (white sheet,
drag handle, sunken card row) used for a confirmation-style dialog.

`RecordingSettingsSheet` and `SavedAudioPanel` are pre-existing shared components used
elsewhere in the app beyond this screen. Per the "reuse existing logic, restyle only" decision
above, their internals are intentionally left on their existing glass-blur visual language
rather than re-themed to this new reference — re-theming shared components based on a
screen-specific reference risks an unintended visual regression everywhere else they're used.
If the user wants those two fully reskinned to the ChatGPT iOS system as well, that's a
follow-up, scoped explicitly rather than inferred.

**Light/dark mode.** `globals.css` already implements this exact design system as a themeable
token set — `--chrome-bg`, `--chrome-bg-sunken`, `--chrome-text-primary`,
`--chrome-text-secondary`, `--chrome-border`, radii (`--chrome-radius-sheet` = 28px, etc.) —
with `:root` (light) and `.dark` variants, mapped to Tailwind utilities (`bg-chrome-bg-sunken`,
`text-chrome-text-secondary`, `rounded-chrome-sheet`, …) via `@theme inline`, plus a working
`ThemeToggle` component using `next-themes`. `UploadActionSheet` is built entirely on these
`chrome-*` utilities instead of hardcoded hex values, so it automatically flips with the app's
light/dark toggle.

**Judgment call — the capture stage itself stays fixed-dark.** The Unified Capture mockup's
own background (`#050506`) is not theme-conditional in the source design — this matches how
camera/recording UIs conventionally behave (Instagram Stories, TikTok, Snapchat capture screens
stay dark regardless of the OS theme, for contrast with live video/waveform content). So
`CaptureHeader`/`CaptureStage`/`CaptureDock` keep their fixed-dark styling from the original
mockup; only the sheets that pop up over that stage (`UploadActionSheet`, and by extension
`RecordingSettingsSheet`/`SavedAudioPanel` if they're ever reskinned) are theme-aware via
`chrome-*` tokens. Flagging this explicitly since it's a real design decision, not something
dictated by either reference — redirect if the capture stage itself should also flip light in
light mode.

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
