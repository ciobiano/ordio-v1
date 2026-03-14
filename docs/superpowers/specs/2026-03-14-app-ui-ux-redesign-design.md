# App UI/UX Redesign — Design Spec

## Problem

The current Ordio app UI is functional but not production-ready. The recording state uses a flat waveform pinned to the bottom, the export screen is cramped with vertically stacked controls requiring excessive scrolling, and the visual language relies on generic blue/purple gradients ("AI slop"). The app needs to feel like a native PWA — immersive, minimal, and world-class — referencing Apple and OpenAI's design systems.

## Solution

A full UI/UX overhaul across all four app states (idle, recording, processing, export) with a monochrome design system anchored by a single colorful hero element: an iridescent VAD-driven orb. The export screen adopts a CapCut/iMovie-style icon toolbar pattern, and a new text-based audio trimming feature leverages existing word-level timestamps.

## Design System

### Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000000` | OLED black background |
| `--primary` | `#FAF8F5` | Text, active icons, CTAs, scrubber fills |
| `--secondary` | `rgba(250,248,245,0.5)` | Inactive labels, hints, timestamps |
| `--tertiary` | `rgba(250,248,245,0.3)` | Lowest emphasis text (Restart, metadata) |
| `--surface` | `rgba(255,255,255,0.04)` | Button backgrounds, inactive icon backgrounds |
| `--surface-hover` | `rgba(255,255,255,0.08)` | Hover and press states |
| `--border` | `rgba(255,255,255,0.06)` | Dividers, panel borders |
| `--destructive` | `#e11d48` | Stop button, trim deletion, destructive actions |

### Typography

- **Font family:** Plus Jakarta Sans (unchanged)
- **Weights:** 200–700 (unchanged)
- **Monospace:** System monospace for timers and timestamps

### Rules

- No purple or blue accent colors in app chrome. No gradients in UI controls.
- Color exists only in: (1) the iridescent orb, (2) user-chosen export video styles (waveform colors, background colors).
- The orb is the singular visual hero element.
- Reference Apple HIG and OpenAI's design language for all UI decisions.
- All interactive elements use `--primary` for active state, `--secondary` for inactive, `--tertiary` for de-emphasized.

## States

### 1. Idle State

The launchpad. Gets the user into recording as fast as possible.

**Layout:**
- Pure black screen
- "ordio" wordmark top-center, `--secondary` opacity
- **Dormant orb** centered — iridescent shader at low intensity, very slow subtle breathing animation (~6s cycle). Muted, frosted, almost asleep. Not VAD-driven.
- Small mic icon centered below the orb (`--secondary`)
- "Tap to record" label below mic icon (`--primary`, 15px, weight 500)
- "or upload audio" ghost link below (`--secondary`, 13px)

**Interactions:**
- Tap orb or mic icon → triggers recording (orb wake-up transition)
- Tap "or upload audio" → file picker → processing pipeline
- No settings, no style selectors, no AudioSettings panel. All settings moved to the recording settings modal.

**What changes from current:**
- `IdleState.tsx` rewritten — remove static `WaveformDisplay`, replace with dormant orb shader component
- `AudioSettings.tsx` removed from idle layout — enhancement tier moves to recording settings modal
- `StyleModeSelector.tsx` removed from idle layout — waveform style moves to recording settings modal

### 2. Recording State

Full-screen immersive recording experience. The orb IS the experience.

**Transition in (idle → recording):**
- Orb "wakes up": brightens from muted to vivid, glow ring expands, iridescence intensifies, shader speed increases. ~0.6s spring curve (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Other idle UI elements (wordmark, "tap to record" text, upload link) fade out simultaneously over 0.3s.

**Layout:**
- Full-screen black (`position: fixed; inset: 0`)
- **Iridescent orb** centered — CSS/WebGL shader, pastel palette (pink, peach, teal, lavender per reference image). Two-layer reactivity:
  - Core orb: scales up on voice detection (1.0 → 1.12), settles on silence
  - Glow ring: pulses independently, intensity tracks voice amplitude
- **Timer** centered below orb (`--secondary`, monospace, 14px, letter-spacing 1px)
- **Bottom bar** — three circular buttons, horizontally centered with space-between:
  - Left: **Pause/Play** toggle (48px circle, `--surface` background, `--primary` icon). Pause icon = two vertical bars. Play icon = triangle.
  - Center: **Stop** (64px circle, `rgba(225,29,72,0.15)` background, `rgba(225,29,72,0.6)` border, 22px red rounded square inside)
  - Right: **Settings** gear icon (48px circle, `--surface` background, `--primary` icon)

**No live captions.** Captions are for the edit phase only. The recording state is purely about the audio experience and VAD feedback.

**Pause behavior:**
- Orb dims to ~70% intensity, shader slows significantly
- Timer freezes
- Pause button icon switches to Play (triangle)
- Tapping Play resumes recording, orb re-intensifies

**Settings modal** (triggered by gear button):
- Bottom sheet, slides up (`translateY(100%) → translateY(0)`, 300ms ease-out)
- Backdrop: `rgba(0,0,0,0.6)` with blur
- Contents:
  - **Waveform style:** Radio group — Bars / Circle / Spectrogram / None. Plus Graphic styles (Frame 1, Frame 2). These control the exported video appearance, not the recording orb.
  - **Audio enhancement:** Radio group — None / Clean / HD Remaster. Locked options show `LockBadge`.
- Close via drag-down gesture or backdrop tap
- Same monochrome design system — `--surface` backgrounds, `--primary` text, `--border` dividers

**After Stop pressed — bottom bar transforms in-place:**
- Orb enters resting state: shader dims, glow fades to ~30%, scale settles to 0.95
- Timer label changes to "X:XX recorded" (`--secondary`)
- Bottom bar content swaps (cross-fade, 200ms):
  - **"Proceed"** — full-width button, `--primary` background (`#FAF8F5`), `#000` text, 14px weight 600, 12px border-radius. Triggers processing pipeline.
  - Below, centered: **Resume** (`--secondary`, 13px, play icon + text) · dot separator (`--tertiary`) · **Restart** (`--tertiary`, 13px, refresh icon + text)

**Resume behavior:** Returns to active recording from where it stopped. Orb re-intensifies, timer continues.

**Restart behavior:** Clears recorded audio, timer resets to 0:00, orb returns to active recording state from scratch.

**What changes from current:**
- `RecordingState.tsx` rewritten — remove canvas waveform at bottom, replace with centered iridescent orb shader
- New `OrbShader.tsx` component (or `Orb.tsx`) — CSS/WebGL iridescent sphere with VAD input prop
- New `RecordingSettingsSheet.tsx` — bottom sheet containing waveform style + enhancement tier
- `LiveCaption.tsx` no longer rendered during recording
- `CaptionStyleSelector.tsx` removed from recording layout
- `StyleModeSelector.tsx` removed from recording layout (moved into settings sheet)
- Pause/resume functionality added to `useAudioRecorder` hook
- Post-stop "Proceed/Resume/Restart" flow added to recording state

### 3. Processing State

**Unchanged.** The processing state serves an informational purpose (progress feedback) and doesn't need the orb metaphor.

- "Creating your video" heading
- `ProgressRing` SVG circular progress
- Processing step list with checkmarks (decode → enhance → transcribe → finalize)
- Simple fade-in transition from recording

### 4. Export/Edit State

The control surface. Users spend the most time here fine-tuning their audiogram.

**Layout (mobile, < 768px):**

**Top nav bar** (fixed):
- Left: back arrow icon (returns to idle with confirmation)
- Center: "Edit" label (`--primary`, 13px, weight 500)
- Right: "Export" text button (`--primary`, 13px, weight 600)

**Canvas preview:**
- Live `renderFrame()` output at correct format aspect ratio
- Format badge top-right (e.g., "1:1") in `--surface` with `--secondary` text
- **Play button overlay** centered — frosted glass circle (44px, `rgba(255,255,255,0.15)` + `backdrop-filter: blur(8px)`), white play triangle inside. Tapping plays/pauses preview.

**Playback scrubber** (below preview):
- Timestamps on left and right (`--tertiary`, monospace, 10px)
- Thin track (3px, `--surface` background)
- Fill: `--primary` color
- Knob: 9px circle, `--primary`

**Icon toolbar** (below scrubber):
- 4 icons in a row, evenly spaced
- Each: 40px rounded-rect icon container + 10px label below
- Active icon: `--surface-hover` background, `--primary` icon and label
- Inactive icon: `--surface` background, `--secondary` icon and label

| Icon | Panel contents |
|------|---------------|
| **Captions** | Word chips (tap to seek, double-tap to edit). Active word highlighted with `--surface-hover` border. Source badge (Whisper/Web Speech). |
| **Style** | Color pickers (waveform, background, text colors). Font selector (8 fonts, locked ones show LockBadge). Font size range slider. |
| **Format** | Aspect ratio selection: 1:1 / 9:16 / 16:9 / 4:5. Segmented control or grid of format previews. |
| **Trim** | Two sections — see Trim Panel below. |

Only one panel visible at a time. Panel content appears below the toolbar with `--border` top separator.

**Trim panel:**

Top section — **Timeline trim:**
- Label: "Timeline" (left, `--secondary`, 11px) + "Drag handles to trim start/end" (right, `--tertiary`, 10px)
- Mini waveform visualization (48px height, `--surface` background, rounded)
- Draggable handles on left and right edges (`--primary` color, 6px wide, centered grip line)
- Trimmed-out regions darkened with `rgba(0,0,0,0.6)` overlay
- Time markers below: start time (left) and end time (right) in `--tertiary` monospace

Divider (`--border`, 1px)

Bottom section — **Word removal:**
- Label: "Remove words" (left) + "Tap words to select · audio follows" (right)
- Word chips in trim mode. Tapping a word toggles selection:
  - Selected: `rgba(225,29,72,0.12)` background, `rgba(225,29,72,0.3)` border, `--destructive` text with `line-through`
  - Unselected: same as normal caption chips
- Action bar below chips: "N words selected" (`--destructive` at 60% opacity) + "Clear" ghost button + "Remove" destructive button
- Removing words splices audio at Whisper word-level timestamps (`Word.start`, `Word.end`) — precise cuts at word boundaries
- Removed words are excluded from both the audio track and caption rendering in the exported video

**Layout (desktop, >= 768px):**
- Same vertical structure, centered
- `max-width: 480px` for the content column (preview + controls)
- More padding and breathing room around all elements
- No sidebar layout — same flow, just wider and more spacious

**What changes from current:**
- `ExportState.tsx` rewritten — vertical scroll layout replaced with icon toolbar + panels
- New `IconToolbar.tsx` component — manages active panel state, renders icons
- New `TrimPanel.tsx` component — waveform handles + word deletion
- `CaptionEditor.tsx` updated — trim mode adds selection/deletion behavior
- `StyleControls.tsx` restructured to fit panel format (currently uses collapsible accordion)
- `FormatToggle.tsx` restructured to fit panel format
- `PlaybackControls.tsx` simplified — play button moves to preview overlay, scrubber stays below
- Audio trimming logic added — splicing `Float32Array` audio data at word timestamp boundaries
- Transcript trimming logic added — filtering out deleted `Word` entries before export

## Transitions

| Transition | Animation |
|-----------|-----------|
| Idle → Recording | Orb wake-up: brighten + scale + glow expand (~0.6s spring). Idle text fades out (0.3s). |
| Recording → Processing | Simple fade (opacity + translateY 8px, 0.35s spring). Same as current `fadeIn`. |
| Processing → Export | Simple fade. |
| Export → Idle ("Create another") | Simple fade. |
| Panel switch (export toolbar) | Cross-fade between panel contents (150ms ease). |
| Settings sheet (recording) | Slide up from bottom (300ms ease-out) + backdrop fade. |
| Stop bar transform | Cross-fade buttons (200ms ease). Orb dims simultaneously. |

## New Components

| Component | Purpose |
|-----------|---------|
| `Orb.tsx` | Iridescent CSS/WebGL shader sphere. Props: `intensity` (0–1, from VAD), `state` ('dormant' / 'active' / 'resting'). Handles wake-up, breathing, and resting animations internally. |
| `RecordingSettingsSheet.tsx` | Bottom sheet modal. Contains waveform style selector + enhancement tier radio group. |
| `IconToolbar.tsx` | Horizontal icon bar for export/edit screen. Manages active panel state. |
| `TrimPanel.tsx` | Timeline waveform with drag handles + word deletion interface. |

## New Hooks / Logic

| Hook/Utility | Purpose |
|-------------|---------|
| `useAudioRecorder` update | Add pause/resume capability to existing recording hook. |
| `useAudioTrimmer` | New hook — manages trim state (start/end handles, deleted word indices). Produces trimmed `Float32Array` and filtered `Word[]` for export. |

## What Does NOT Change

- `CanvasPreview.tsx` — same live canvas rendering, just repositioned in new layout
- `renderFrame()` — same drawing code
- Processing pipeline — same decode → enhance → transcribe → finalize flow
- Zustand store shape — same phases (idle/recording/processing/export)
- `fontLoader.ts` — unchanged
- `waveformSampler`, shared package, Zod schemas — unchanged
- Authentication flow (`AuthGate.tsx`) — unchanged
- Backend (Convex, API routes) — unchanged

## Scope Boundary

This spec covers the app UI/UX only. The following are **out of scope**:
- Landing/marketing page (separate spec exists at `docs/superpowers/specs/2026-03-11-landing-page-design.md`)
- Web Worker export pipeline (separate spec at `docs/superpowers/specs/2026-03-13-web-worker-export-design.md`)
- Authentication redesign
- New backend features
