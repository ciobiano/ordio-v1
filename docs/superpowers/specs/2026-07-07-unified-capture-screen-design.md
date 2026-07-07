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

## Reverted "fidelity correction" — the mockup's redesign is the target, not the old app

Partway through implementation, screenshots of the deployed `.dc.html` prototype (a Claude
Design renderer preview) led to an over-correction: several new interaction/visual patterns
from the mockup got reverted back toward the *old* app's existing components — a two-branch
`RecordingBottomBar` swap instead of one morphing dock row, a MIC-bar+badge instead of the
mockup's plain typewriter/caret status text, a full-screen ring+checklist instead of the
orb-stays-visible processing state, and no changes at all to `SavedAudioPanel` or
`RecordingSettingsSheet`.

**The user corrected this directly: the mockup's redesign is authoritative for everything
except the orb itself** ("the hub should remain the same... every other feature that was in
that design should be implemented"). This spec now reflects that correction:

- **`CaptureDock` is one morphing row, not a branch-swap.** Idle: upload pill + press-and-hold
  record button + settings button. Every other phase shares the same left-slot / center-slot /
  mid-button / cancel-button structure, with slot *contents* morphing (stop↔settings,
  waveform↔"Process recording"↔progress fill, pause↔play↔restart) — matching the mockup's
  `leftSlotStyle`/`centerSlotStyle`/`pauseBtnStyle` continuous-transition approach, not two
  structurally different layouts.
- **`CaptureStage`'s status line is the mockup's typewriter/caret text** ("Listening", "Too
  quiet", "Paused", "Ready to process"), not a MIC-level bar and colored quality badge borrowed
  from the old `RecordingCenterStatus`.
- **Processing keeps the orb** (shrunk to 128px, per the phase's own size table) with the thin
  progress-fill bar living in the dock's center slot — not a separate no-orb ring+checklist
  screen.
- **`SavedAudioPanel` gets the mockup's visual language**: a left-anchored slide-in panel
  (`direction="left"` on the `Drawer`, not the default bottom sheet), gradient icon tiles
  (`linear-gradient(165deg, #c4cde2, #3aa0e8)`) per row, monospace duration/date metadata, "Your
  recordings" title. Its underlying data logic — search, sort, rename, delete, pagination via
  Convex — is preserved; only the presentation changes, since removing working functionality
  wasn't part of the ask. It's reachable from `CaptureHeader`'s hamburger button again (idle →
  hamburger opens it; any other phase → back arrow, matching the mockup), controlled via
  `open`/`onOpenChange`/`hideTrigger` props rather than its own independent FAB trigger.
- **`RecordingSettingsSheet`** gets a lighter touch: its content already matches the mockup
  (Visual/Frames/Stage/Caption chips, Audio Enhancement rows), so only its shell moved from a
  blurred glass surface to the mockup's flat dark sheet (`#0d0d10`, 26px top radius) — logic
  untouched.

The mocked live caption (`useMockLiveCaption`) still replaces the status line when voice is
detected, per the earlier "keep it as a placeholder for now" direction — real streaming
transcription remains tracked in `TODOS.md`.

## Component architecture

New directory: `apps/web/src/components/soul/capture/`

- **`CaptureScreen.tsx`** — replaces the `AnimatePresence` block in `create/page.tsx`. Owns
  the derived `phase` value and passes it down. Single persistent mount for the lifetime of
  the create flow (idle through processing); still unmounts on navigation to
  `/create/export/[sessionId]`.
- **`CaptureHeader.tsx`** — left nav button morphs hamburger (idle, opens the redesigned
  `SavedAudioPanel`) ↔ back arrow (every other phase, triggers `handleReset`), matching the
  mockup exactly. Avatar (`UserAvatarButton`) is idle-only, fading out otherwise.
- **`CaptureStage.tsx`** — houses the existing `Orb` component and the status text region.
  Only the orb's size and vertical position are animated per phase (CSS custom properties +
  Framer Motion `animate`), matching the mockup's proportions: idle 216px → recording/paused
  200px → ready 196px → processing 128px.

  **Status text is audio-reactive, not just phase-reactive.** The mockup's own prototype
  script only distinguishes "quiet" vs "not quiet" via a single boolean, but real screenshots
  of the deployed reference name a third, distinct state (`recording-too-quiet` vs
  `recording-voice-detected`) that the interactive prototype doesn't fully encode. `phase.ts`'s
  `deriveStatusText` adds that third branch using the same 0.08 audio-level threshold the old
  app's `getQualityBadge` used for the same distinction — matching threshold, not matching
  presentation (no MIC bar, no colored badge; plain typewriter/caret text, per the mockup):

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
- **`CaptureDock.tsx`** — bottom control row, one persistent container across every phase.
  Idle: upload pill + press-and-hold record button + settings button. Every other phase shares
  a left-slot / center-slot / mid-button / cancel-button structure whose *contents* morph:
  left slot is stop (dark, recording/paused → `ready`) or settings (neutral, ready/processing);
  center slot is animated waveform bars (recording/paused), the "Process recording" label
  (ready, tappable), or a progress-fill bar (processing); mid button is pause/play/restart
  (destructive-tinted, hidden during processing); cancel is always present except idle. This
  is the mockup's actual interaction model — the same buttons transform in place rather than
  a full layout swap between phases.
- **`UploadActionSheet.tsx`** — new Base UI `Dialog`-based action sheet (Photo Library / Take
  Video / Choose File / Cancel). Wraps the existing hidden `<input type="file">` and
  `flow.handleFileSelect` in `useCreateFlow`; "Photo Library"/"Take Video" set the input's
  `accept`/`capture` attributes before triggering it, "Choose File" triggers it directly. No
  new file-handling logic.

Reused for their data/interaction logic, restyled to match the mockup:
- **`RecordingSettingsSheet`** — internal state/logic unchanged (its Visual/Frames/Stage/Caption
  chips and Audio Enhancement rows already matched the mockup's content). Shell restyled from a
  blurred glass surface to the mockup's flat dark sheet (`#0d0d10`, 26px top radius); still a
  `vaul` `Drawer` underneath, not rebuilt on a different primitive.
- **`SavedAudioPanel`** ("Your recordings" panel) — visual language fully redone to match the
  mockup: left-anchored slide-in (`Drawer` `direction="left"`, not a bottom sheet), gradient
  icon tiles per row (`linear-gradient(165deg, #c4cde2, #3aa0e8)`), monospace duration/date
  metadata, "Your recordings" title. Search, sort, rename, delete, and pagination logic are
  unchanged — only presentation changed, since the ask was a new design, not new/removed
  functionality. Trigger changed from its own independent FAB to controlled `open` /
  `onOpenChange` / `hideTrigger` props, opened via `CaptureHeader`'s hamburger button per the
  mockup.

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
