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
| `--surface-active` | `rgba(255,255,255,0.12)` | Selected/active state (toolbar icons) |
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
- Tap orb or mic icon → triggers recording (orb wake-up transition). The orb renders as a `<button aria-label="Start recording">` wrapper around the shader element — keyboard-focusable and accessible.
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
- When `isPaused` is true, the orb locks to 70% intensity regardless of analyser output. The analyser loop stops naturally (since `isRecording` becomes false), but the orb's dim state is driven by the `isPaused` flag, not by zero audio level.
- Shader animation slows significantly (~0.2x speed)
- Timer freezes
- Pause button icon switches to Play (triangle)
- Tapping Play resumes recording — orb re-intensifies, analyser reconnects to the active stream

**Settings modal** (triggered by gear button):
- Bottom sheet, slides up (`translateY(100%) → translateY(0)`, 300ms ease-out)
- Backdrop: `rgba(0,0,0,0.6)` with blur
- Contents:
  - **Waveform style:** Radio group — Bars / Circle / Spectrogram / None. Plus Graphic styles (Frame 1, Frame 2). These control the exported video appearance, not the recording orb. Circle and Spectrogram are gated behind feature flags — locked options show `LockBadge`.
  - **Caption style:** Radio group — Bottom / Center / Karaoke. Karaoke is gated — locked option shows `LockBadge`. (Moved from the `CaptionStyleSelector` top-right pill, which is removed.)
  - **Audio enhancement:** Radio group — None / Clean / HD Remaster. Locked options show `LockBadge`.
  - Tapping any locked option triggers `onLocked(featureKey)` → opens `UpgradeSheet`. `FeatureKey` values match the existing `featureGates.ts` keys: `'waveform_circle'`, `'waveform_spectrogram'`, `'caption_karaoke'`, `'format_vertical'`, `'format_horizontal'`, `'format_instagram'`, `'enhance_clean'`, `'enhance_hd'`, plus font-specific keys.
- Close via: backdrop tap, Escape key, or drag-down gesture (threshold: 100px downward drag dismisses with spring animation). No X button — the sheet pattern is standard enough.
- Same monochrome design system — `--surface` backgrounds, `--primary` text, `--border` dividers

**After Stop pressed — bottom bar transforms in-place:**

The post-stop checkpoint is **local UI state** inside `RecordingState` (a `useState<'recording' | 'stopped'>` — not a new Zustand `AppPhase`). The existing `page.tsx` `useEffect` that auto-triggers `processAudio` when `recorder.state === 'stopped'` must be removed — processing is now triggered explicitly when the user taps "Proceed."

- Orb enters resting state: shader dims, glow fades to ~30%, scale settles to 0.95
- Timer label changes to "X:XX recorded" (`--secondary`). Format: `M:SS` (e.g., `0:00`, `1:23`, `12:34`). For recordings over 60 minutes use `H:MM:SS`.
- Bottom bar content swaps (cross-fade, 200ms):
  - **"Proceed"** — full-width button, `--primary` background (`#FAF8F5`), `#000` text, 14px weight 600, 12px border-radius. Triggers processing pipeline (`processAudio()`).
  - Below, centered: **Resume** (`--secondary`, 13px, play icon + text) · dot separator (`--tertiary`) · **Restart** (`--tertiary`, 13px, refresh icon + text)

**Resume behavior:** Returns to active recording from where it stopped. Calls `recorder.resumeRecording()`. Orb re-intensifies, timer continues, analyser reconnects.

**Restart behavior:** Calls `recorder.resetRecording()` then re-invokes `handleStartRecording()` from `page.tsx` (which calls `getUserMedia` for a fresh mic stream, reconnects analyser, and starts recording from scratch). Timer resets to 0:00, orb enters active state.

**What changes from current:**
- `RecordingState.tsx` rewritten — remove canvas waveform at bottom, replace with centered iridescent orb shader
- New `Orb.tsx` component — iridescent sphere with VAD input prop (see Orb Technical Approach section)
- New `RecordingSettingsSheet.tsx` — bottom sheet containing waveform style + enhancement tier
- `LiveCaption.tsx` no longer rendered during recording
- `CaptionStyleSelector.tsx` removed from recording and export layouts — caption style moves to recording settings sheet
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
- Left: back arrow icon → confirmation dialog: "Discard changes and start over?" with "Discard" (destructive) and "Cancel" buttons. Returning to idle discards all edits.
- Center: "Edit" label (`--primary`, 13px, weight 500)
- Right: "Export" text button (`--primary`, 13px, weight 600)
- `UserButton` (Clerk auth) — small avatar circle to the left of "Export", maintaining auth access without a dedicated header row

**Canvas preview:**
- Live `renderFrame()` output at correct format aspect ratio
- Format badge top-right (e.g., "1:1") in `--surface` with `--secondary` text
- **Play button overlay** centered — frosted glass circle (44px, `rgba(255,255,255,0.15)` + `backdrop-filter: blur(8px)`), white play triangle inside. Tapping plays/pauses preview. Preview is paused on entry (no autoplay). After export completes, canvas preview remains (do not switch to a video element).
- **Live preview updates:** The canvas preview renders via `renderFrame()` which reads transcript, styles, and caption position from the Zustand store. Edits in any panel (word changes in Captions, color changes in Style, format changes in Format, word deletions in Trim) update the store and the preview re-renders in real time. This is existing behavior — no new wiring needed.

**Playback scrubber** (below preview):
- Timestamps on left and right (`--tertiary`, monospace, 10px)
- Thin track (3px, `--surface` background)
- Fill: `--primary` color
- Knob: 9px circle, `--primary`

**Icon toolbar** (below scrubber):
- 4 icons in a row, evenly spaced
- Each: 40px rounded-rect icon container + 10px label below
- Active icon: `--surface-active` background, `--primary` icon and label
- Inactive icon: `--surface` background, `--secondary` icon and label

| Icon | Panel contents |
|------|---------------|
| **Captions** | Word chips (tap to seek, double-tap to edit). Active word highlighted with `--surface-active` border. Source badge (Whisper/Web Speech). **Empty state:** If `transcript` is empty, show centered `--secondary` text "No captions available" with `--tertiary` hint "Check microphone permissions or try again." **Loading state:** While `isTranscribing` is true, show shimmer skeleton or `--secondary` text "Transcribing..." |
| **Style** | Color pickers (waveform, background, text colors). Font selector (8 fonts, locked ones show LockBadge). Font size range slider. Note: caption *position* style (Bottom/Center/Karaoke) is set in the recording settings sheet — this panel is for visual appearance only. |
| **Format** | Aspect ratio selection. Label → `FormatVariant` mapping: **1:1** → `'square'` (1080×1080), **9:16** → `'vertical'` (1080×1920), **16:9** → `'horizontal'` (1920×1080), **4:5** → `'instagram'` (1080×1350). 9:16, 16:9, and 4:5 are gated behind feature flags — locked options show `LockBadge`. Bug fix needed: `setFormat('instagram')` in `store.ts` currently falls through to horizontal dimensions instead of 1080×1350. |
| **Trim** | Two sections — see Trim Panel below. |

Only one panel visible at a time. Panel content appears below the toolbar with `--border` top separator.

**Trim panel:**

Top section — **Timeline trim:**
- Label: "Timeline" (left, `--secondary`, 11px) + "Drag handles to trim start/end" (right, `--tertiary`, 10px)
- Mini waveform visualization (48px height, `--surface` background, rounded). Data source: `waveformSampler()` from `packages/shared/src/waveform.ts` downsamples `audioBuffer` into a bar array. Drawn on a static `<canvas>` element (not the animated `WaveformDisplay`).
- Draggable handles on left and right edges (`--primary` color, 6px wide, centered grip line). Handle dragging uses `onPointerDown` / `onPointerMove` / `onPointerUp` events for cross-device (mouse + touch) support.
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

## Accessibility

All interactive elements require ARIA labels and keyboard support:

**Recording state buttons:**
- Pause/Play: `<button aria-label="Pause recording">` / `<button aria-label="Resume recording">` (label toggles with state)
- Stop: `<button aria-label="Stop recording">`
- Settings: `<button aria-label="Recording settings">`
- Proceed: `<button aria-label="Proceed to editing">`
- Resume (post-stop): `<button aria-label="Resume recording">`
- Restart: `<button aria-label="Restart recording">`

**Export icon toolbar:**
- Each icon button: `<button aria-label="Captions">`, `aria-label="Style"`, `aria-label="Format"`, `aria-label="Trim"`
- Active icon: `aria-pressed="true"`

**Settings sheet:**
- Focus trap: when sheet opens, focus moves to first interactive element. Tab cycles within the sheet. Escape key closes it.
- Sheet container: `role="dialog"`, `aria-label="Recording settings"`, `aria-modal="true"`
- Radio groups: standard `role="radiogroup"` with `role="radio"` items and `aria-checked`

**General:** All buttons are keyboard-activatable (Enter/Space). Focus ring: `outline: 2px solid rgba(250,248,245,0.8)` + `box-shadow` glow (existing pattern from `globals.css`).

## Orb Technical Approach

**Rendering technology:** Pure CSS with layered techniques. No WebGL or Three.js required — CSS achieves the iridescent effect with better browser compatibility and simpler implementation.

**Structure:**
```
<button aria-label="Start recording" class="orb-container">
  <div class="orb-glow-ring" />     <!-- Outer ambient glow -->
  <div class="orb-core">            <!-- Main sphere -->
    <div class="orb-gradient" />     <!-- Rotating conic-gradient, heavily blurred -->
    <div class="orb-highlight" />    <!-- Radial gradient for 3D depth/specular -->
    <div class="orb-rim" />          <!-- Subtle border for glass edge -->
  </div>
</button>
```

**Color palette (from reference image):**
- Conic gradient stops: `rgba(255,190,210,0.7)` (pink), `rgba(160,220,230,0.6)` (teal), `rgba(255,200,170,0.7)` (peach), `rgba(200,180,240,0.5)` (lavender)
- Highlight: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, transparent 60%)`
- Rim: `border: 1px solid rgba(255,255,255,0.15)`
- Glow ring: `radial-gradient(circle, rgba(255,180,200,0.15) 0%, transparent 70%)`

**Size:** 200px diameter on mobile at rest. Scales to 240px on desktop (>768px).

**Animation by state:**

| State | Gradient rotation | Blur | Scale | Glow opacity | Speed |
|-------|------------------|------|-------|-------------|-------|
| `dormant` | 360° continuous | 22px | 1.0, slow breathing ±0.02 | 0.3 | ~12s rotation, 6s breathing cycle |
| `active` | 360° continuous | 18px (less blur = more vivid) | 1.0–1.12 (driven by `intensity`) | 0.6–1.0 (driven by `intensity`) | ~4s rotation |
| `resting` | stopped | 24px (more blur = softer) | 0.95 | 0.2 | static |

**Prop contract:**
- `state: 'dormant' | 'active' | 'resting'` — controls animation mode. State transitions use CSS transitions (0.6s spring for wake-up, 0.3s ease for resting).
- `intensity: number` (0–1) — only read when `state === 'active'`. Drives `transform: scale()` and glow ring opacity via CSS custom properties (`--orb-intensity`) updated by the parent via a ref or inline style. When `state` is `dormant` or `resting`, `intensity` is ignored.

**Browser support:** CSS conic-gradient is supported in all modern browsers (Chrome 69+, Safari 12.1+, Firefox 83+). The `filter: blur()` is hardware-accelerated. No WebGL fallback needed.

## Audio Trim Implementation

**Approach: Non-destructive.** Trim state is stored as metadata, not applied to the audio buffer. The original `audioBuffer` in the Zustand store is never mutated. Trimming is applied at export time only.

**`useAudioTrimmer` hook signature:**

```typescript
interface TrimState {
  startTime: number;        // seconds, from timeline handle
  endTime: number;          // seconds, from timeline handle
  deletedWordIndices: Set<number>;  // indices into transcript Word[]
}

interface UseAudioTrimmerReturn {
  trimState: TrimState;
  setStartTime: (t: number) => void;
  setEndTime: (t: number) => void;
  toggleWordDeletion: (index: number) => void;
  clearDeletions: () => void;
  getTrimmedAudio: (audioBuffer: AudioBuffer) => Float32Array[];
  getTrimmedTranscript: (transcript: Word[]) => Word[];
}
```

**`getTrimmedAudio` implementation:**
1. Compute sample ranges to keep: start from `startTime * sampleRate`, end at `endTime * sampleRate`
2. For each deleted word, compute its sample range from `word.start` and `word.end` timestamps
3. Build a new `Float32Array` per channel by concatenating the kept ranges, skipping deleted word ranges
4. **No crossfade** at cut boundaries — word-level cuts from Whisper are already at natural speech boundaries (pauses between words). If clicks are audible in testing, add a 5ms linear fade at each cut point as a follow-up.

**`getTrimmedTranscript` implementation:**
1. Filter out words whose indices are in `deletedWordIndices`
2. Filter out words outside `[startTime, endTime]`
3. Re-base remaining word timestamps to account for removed durations (shift `start`/`end` earlier by the cumulative duration of preceding deleted words)

**The trimmed audio and transcript are passed to the export pipeline** (`startExport` in `useVideoExporter`), replacing the raw `audioBuffer` and full `transcript`.

## Error Handling

- **Export failure:** Show `toast.error()` via Sonner with the error message. Re-enable the "Export" button. No inline error display in the export panel — toasts are sufficient and match the existing pattern.
- **Recording failure** (mic permission denied, getUserMedia error): Show `toast.error()` with guidance. Return to idle state.
- **Trim produces empty audio** (all words deleted or handles overlap): Disable the "Export" button, show `--destructive` hint text "No audio remaining" below the trim panel.

## Layout Mechanics

**`CapabilityBanner`:** Preserved. Renders above the top nav bar with a higher `z-index`. Same fixed-top behavior as current, dismissible to `sessionStorage`.

**Idle → Recording transition:** `RecordingState` renders as a `position: fixed; inset: 0; z-index: 50` overlay. Both `IdleState` and `RecordingState` are mounted simultaneously for the 0.6s transition window — `IdleState` fades out while `RecordingState` fades in over it. After the transition completes, `IdleState` unmounts (Zustand phase changes to `recording`). This avoids a hard cut while keeping the orb visually continuous.

**`StyleModeSelector` removal from `page.tsx`:** The fixed bottom-right `StyleModeSelector` element rendered directly in `page.tsx` (outside any state component) is removed entirely. Waveform style selection is now inside `RecordingSettingsSheet`.

**Export progress bar:** Uses `--primary` fill color (warm off-white), no gradient. Replaces the current `linear-gradient(to right, #3b82f6, #8b5cf6)`.

## New Components

| Component | Purpose |
|-----------|---------|
| `Orb.tsx` | Iridescent CSS shader sphere. Props: `intensity` (0–1, from VAD), `state` ('dormant' / 'active' / 'resting'). Renders as `<button>` wrapper for accessibility. See Orb Technical Approach section. |
| `RecordingSettingsSheet.tsx` | Bottom sheet modal. Contains waveform style selector, caption style selector, and enhancement tier radio group. Props include `onLocked: (feature: FeatureKey) => void` to trigger `UpgradeSheet`. |
| `IconToolbar.tsx` | Horizontal icon bar for export/edit screen. Manages active panel state. |
| `TrimPanel.tsx` | Timeline waveform with drag handles + word deletion interface. |

## New Hooks / Logic

| Hook/Utility | Purpose |
|-------------|---------|
| `useAudioRecorder` update | Add `pauseRecording()`, `resumeRecording()`, and `resetRecording()` methods. Add `isPaused` state. |
| `useAudioTrimmer` | New hook — manages non-destructive trim state (start/end times, deleted word indices). Produces trimmed `Float32Array[]` and filtered `Word[]` at export time. See Audio Trim Implementation section. |

## What Does NOT Change

- `CanvasPreview.tsx` — same live canvas rendering, just repositioned in new layout
- `renderFrame()` — same drawing code
- Processing pipeline — same decode → enhance → transcribe → finalize flow
- Zustand store shape — same phases (idle/recording/processing/export). Post-stop checkpoint is local state in `RecordingState`, not a new phase.
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
