# Export Screen — Complete Functional Inventory

Reference for redesign. Every control, what it does, where the state lives, and how the
architecture is layered. Current as of branch `feature/mobile-ui-cleanup`.

---

## 1. Architecture

### 1.1 Route & mount

```
/create/export/[sessionId]                  apps/web/src/app/create/export/[sessionId]/page.tsx
  └─ CreateLayout (create/layout.tsx)       auth gate + UpgradeSheet + capability banner
       └─ <ExportState />                   components/soul/states/ExportState/index.tsx
```

`page.tsx` is the **data boundary**. It does four things and nothing else:

| Responsibility | Detail |
|---|---|
| Session fetch | `api.sessions.getSession` → `null` = expired → toast + `router.replace('/create')` |
| Audio hydration | Fetch `getAudioUrl` → `decodeBlobToAudioBuffer` → `setAudioBuffer/setAudioBlob/setAudioDuration/setTranscript` |
| Owns the two engines | `useVideoExporter()` and `usePlayback()` — created here, passed down as props |
| Four callbacks | `onExportStart` (billing gate), `onDownload` (anchor click), `onReset` (cancel + stores reset + route to `/create`), `onLocked` (= `setUpgradeTarget`) |

Three render states in `page.tsx`:
- `session === undefined || isHydrating || !audioBuffer` → centered spinner
- `session === null` → "Recording not found. Redirecting…"
- otherwise → `<ExportState>`

`showWatermark` is derived here: `tier === 'free'`.

### 1.2 Component tree

```
ExportState (index.tsx)                     — orchestrator; owns trim history
├── ExportHeader                            — fixed top bar: Back + one primary action
├── scroll region (the only scrolling element on mobile)
│   ├── ExportCanvas
│   │   ├── CanvasPreview                   — the <canvas> + all canvas-anchored controls
│   │   │   ├── CanvasCaptionTransformOverlay
│   │   │   ├── format badge / stage-flip / play overlay / bg-loading spinner
│   │   ├── StageControlBar                 — DESKTOP ONLY (hidden md:flex)
│   │   └── PlaybackControls                — play/pause + scrubber + timecodes
│   └── ExportControls
│       ├── DESKTOP: panelCard + IconToolbar + inline panel body
│       └── MOBILE : fixed bottom surface = expanding panel + Dock
│           ├── CaptionEditor
│           ├── StyleControls
│           ├── TrimPanel
│           ├── FormatToggle
│           └── DirectorSheet (Drawer, separate layer)
├── ExportFooter                            — only renders the "no audio remaining" alert
├── ExportOverlay                           — centered modal: progress / error / success
└── DiscardDialog                           — AlertDialog on Back
```

### 1.3 State ownership

| State | Owner | Persisted? |
|---|---|---|
| `style` (StyleConfig), `waveformStyle`, `graphicStyle`, `canvasLayout`, `format`, `captionTransform`, `theme` | `useUIStore` (zustand + `persist`, key `ordio-ui-preferences`, version 2) | ✅ localStorage |
| `upgradeTarget`, `currentState` | `useUIStore` (session only, excluded from `partialize`) | ❌ |
| `transcript`, `captionGroups`, `selectedGroupIndices`, `captionUndoStack`/`captionRedoStack` | `useProcessingStore` | ❌ |
| `audioBuffer`, `audioBlob`, `audioDuration` | `useCaptureStore` | ❌ |
| Director `looks`, `isGenerating`, `error` | `useDirectorStore` | ❌ |
| Trim handles, deleted silence ranges | `useAudioTrimmer(duration)` — local hook state inside `ExportState` | ❌ |
| Trim undo/redo snapshots (`past`/`future`, MAX 5) | `useState` in `ExportState` | ❌ |
| Panel selection, drawer open, director open | `useState` in `ExportControls` | ❌ |
| Transform gesture (`isTransformActive`, hint) | `useCaptionGesture` inside `CanvasPreview`; hint-seen flag in `localStorage['ordio-caption-edit-hint-seen']` | partial |

**Two independent undo stacks exist and neither knows about the other:**
- Caption edits → `processingStore`, 50 steps, buttons live in `CaptionEditorHeader`.
- Trim commits → `ExportState` local, 5 steps, buttons live in `TrimPanel`.

### 1.4 Mobile layout mechanics (the load-bearing bits)

- **Header** is `position: fixed`, `top: env(safe-area-inset-top)`, z-30. Uses **inline style props**
  (`background`, `backdropFilter`, `borderBottom`) — the one place in this screen that breaks the
  CVA rule.
- **`ExportCanvas`** compensates with `pt-[env(safe-area-inset-top)] mt-16`.
- **Scroll region** is `flex-1 min-h-0 overflow-y-auto … pb-24`. It is deliberately the *only*
  scroller: header fixed + dock fixed, so the page body never scrolls. This was the fix for iOS
  rubber-band bounce.
- **Bottom surface** is `fixed inset-x-0 bottom-0 z-40 md:hidden`. Panel and dock share **one**
  surface — the panel grows out of the dock via a `grid-rows-[0fr] → [1fr]` transition
  (300ms, `cubic-bezier(0.32,0.72,0,1)`), not a separate layered drawer.
- **Dock height**: `calc(49px + env(safe-area-inset-bottom) + 8px)`.
- **Panel heights**: `h-[46vh]` for captions/style/trim, `h-[26vh]` for format (`COMPACT_PANELS`).
- **Dismiss gestures**: grabber tap, or drag down > 80px offset **or** > 600px/s velocity
  (`framer-motion` `dragSnapToOrigin`, `dragListener={false}`, started manually on the grabber).
- **Tap-active-item-again** collapses the panel.

### 1.5 Desktop layout

Side-by-side: canvas column (`flex-1`) + `md:w-80 shrink-0` panel card. `IconToolbar` on top of
the panel; `StageControlBar` under the canvas.

---

## 2. `ExportHeader` — top bar

| Control | Behaviour |
|---|---|
| **Back** (arrow-left icon, 44×44, `bg-white/10`) | Opens `DiscardDialog`. Never navigates directly. |
| **Primary action** (text button, `text-acid-accent`, 17px semibold) | Label and target are derived: |

```
hasRender = exportedUrl !== null && !isExporting

label   = hasRender ? 'Save'
        : error     ? 'Retry export'
        :             'Export'

onClick = hasRender ? open ExportOverlay
        :             handleExport()

disabled = (isExporting || trimmer.isEmpty) && !hasRender
```

**`DiscardDialog`** — AlertDialog. Title "Discard changes?", body "Your edits and recording will be
lost. This cannot be undone." Cancel / **Discard** (destructive). Discard runs `onReset` →
`cancelExport()` + `playback.stop()` + reset all three stores + `router.push('/create')`.

---

## 3. `ExportCanvas` — the stage

### 3.1 `CanvasPreview` — canvas-anchored controls

The canvas itself is `<canvas width={canvasWidth} height={canvasHeight}>` at the real export
resolution, CSS-scaled. Aspect ratio is fed in as `--canvas-aspect-ratio` custom property.

| Element | Position | Behaviour |
|---|---|---|
| **Format badge** | top-2 left-2, z-20 | Read-only label: `1:1` / `9:16` / `16:9` / `4:5`. `aria-hidden`. |
| **Stage flip** (FlipVerticalIcon) | top-2 right-2, z-40, **`md:hidden`** | Toggles `canvasLayout` between `'top'` and `'flipped'`. Flipping to `flipped` is gated on `layout_flipped` → fires `onLocked`. Mobile-only mirror of the desktop `StageControlBar` "Stage" button. |
| **Full-canvas play/pause** | `inset-0`, z-20 | Invisible button. Toggles playback. |
| **Center play indicator** | centered, z-30, `pointer-events-none` | Scales to 0.9 / fades out while playing (300ms). |
| **Background loading spinner** | `inset-0`, z-20 | Shown while `bgLoading \|\| bgImageLoading`. |
| **"Show captions" pill** | bottom-3 right-3, z-40 | Only when `captionTransform.visible === false`. Restores captions **and resets scale/rotation/offset to defaults**. |
| **Caption transform overlay** | matches caption box, z-40 | See below. |

**Keyboard**: `Space` toggles play/pause globally (ignored when focus is in input/textarea/select).

### 3.2 Caption transform gesture (`useCaptionGesture` + `CanvasCaptionTransformOverlay`)

Two modes:

**Inactive** — an invisible hotspot sits over the caption box.
- Single tap/click → falls through to **play/pause** (resolved after a double-tap window timer).
- Double tap / double click → enters transform mode, writes `ordio-caption-edit-hint-seen`.
- First-visit affordance: the box stroke pulses (`.caption-hint-pulse`) for 3600ms, once ever.

**Active** — bordered box with three 36×36 round handles:

| Handle | Position | Gesture | Range |
|---|---|---|---|
| **Delete** (Delete02Icon) | top-left | click | sets `captionTransform.visible = false` |
| **Rotate** (Rotate02Icon) | top-right | drag X | `rotationDeg += dx * 0.35`, **unclamped** |
| **Resize** (CropIcon) | bottom-right | drag | `scale += (dx/W + dy/H) * 1.2`, clamped `0.45–2.8` |
| **Move** | drag the box body | drag | `offsetXRatio/offsetYRatio` clamped `±0.45` |

Pointer-down anywhere outside the overlay exits transform mode.

### 3.3 `PlaybackControls`

| Control | Behaviour |
|---|---|
| **Play/Pause** | 36×36 round, `bg-white/8`. Disabled when `duration === 0`. |
| **Current time** | `mm:ss`, updated via direct DOM write per rAF frame (no React re-render). |
| **Scrubber** | `role="slider"`, 6px track. Pointer down/move/up; fill uses `transform: scaleX()`. Seek fires **on pointer-up only**. |
| **Duration** | `mm:ss`, static. |

Playback internals worth knowing: `usePlayback` notifies DOM listeners every frame (hot path) but
throttles React `currentTime` state to **every 15th frame (~4fps)** — that's the resolution the
caption editor's active-row highlight runs at.

### 3.4 `StageControlBar` — **desktop only**

Horizontal scroll row of three 44px-tall pills under the canvas.

| Control | Type | Options |
|---|---|---|
| **Visual** | Popover | `Bars` · `Orbit`🔒 · `Spectrum`🔒 · `Orb` · `Baseline` · `Clean` · `Frames ›` (expands to `Frame 1` / `Frame 2`) |
| **Animation** | Select | `Reveal` · `Pop` · `Cut` · `Karaoke` |
| **Stage** | Toggle button | `Upper` ⇄ `Lower` (🔒 on `layout_flipped`) |

**Visual is disabled entirely** (opacity 45, `cursor-not-allowed`) when the active caption preset
has `ownsStage: true` — currently only `karaoke-chip`. Label then reads "Full-stage".

Everything in this bar is duplicated on mobile: Visual/Animation live in the Style panel's tabs,
Stage lives as the canvas-anchored flip button. The bar was made desktop-only because it overflowed
horizontally at narrow widths.

---

## 4. The Dock — mobile navigation

`DOCK_ITEMS` in `ExportControls.tsx`. Five items, icon (25px, stroke 1.5) over a 10px label,
44px min-height, `justify-around`.

| # | id | Label | Icon | Opens |
|---|---|---|---|---|
| 1 | `director` | **Direct it** | `AiMagicIcon` | `DirectorSheet` (separate Drawer — does *not* use the panel surface) |
| 2 | `captions` | **Captions** | `SubtitleIcon` | `CaptionEditor` panel, 46vh |
| 3 | `style` | **Edit Style** | `PaintBoardIcon` | `StyleControls` panel, 46vh |
| 4 | `trim` | **Trim** | `ScissorIcon` | `TrimPanel` panel, 46vh, scrollable |
| 5 | `format` | **Reframe** | `CropIcon` | `FormatToggle` panel, 26vh, scrollable |

Active state = white text/full-opacity icon; inactive = `white/60`. `activeItem` is `null` whenever
the drawer is closed, so no item reads active in the collapsed state.

**Desktop equivalent (`IconToolbar`) has only three items** — Captions, Style, Trim. No Director,
no Reframe. `ToolbarPanel` type includes `'format'` but nothing on desktop can select it, and the
desktop panel body renders nothing for it.

---

## 5. Category: **Direct it** (`DirectorSheet`)

Bottom Drawer, `max-h-[70vh]`, grabber + close button.

| Element | Behaviour |
|---|---|
| Auto-generate | On open, if no looks and not generating and no error → `generateLooks()` |
| Loading | "Directing your video…" |
| Error | Message + **Try again** button |
| **Look cards** | Horizontal scroll strip, 3 cards (`DirectorLookCard`), `role="listbox"`. Tap applies the look and closes the sheet. |
| **Reroll** | Ghost button. Regenerates all three. |

**Gating**: `director_reroll`. Look **index 0 is free**; looks 1 and 2 and the Reroll button are
Creator-only and carry a `LockBadge`. Tapping a locked look fires `onLocked('director_reroll')`
instead of applying.

A "look" is a `LOOK_PRESETS` entry — a bundle that sets caption style + colors + visual together.
The 12 presets: Neon Pop, Street Bold, Sunset Karaoke, Clean Minimal, Bold Statement, Editorial
Script, Warm Pop, Electric Outline, Centered Block, Urban Phrase, Orb + Phrase, Cream Block.

---

## 6. Category: **Captions** (`CaptionEditor`)

Operates on `captionGroups` (derived groupings of `transcript` words), not raw words.

### 6.1 Empty / loading states
- `isTranscribing` → "Transcribing audio… / This may take a moment"
- no transcript → "No captions available / Check microphone permissions or try again"

### 6.2 Header (`CaptionEditorHeader`) — sticky

Always visible row: eyebrow "EDIT CAPTIONS" + **Undo** / **Redo** (28×28 icon buttons, 30% opacity
when disabled). Backed by `processingStore`, 50-step stack.

**A second toolbar row appears only when a group is selected**, three equal-width buttons:

| Button | Enabled when | Action |
|---|---|---|
| **Split** / **Split here** | group has ≥ 2 words | If a cursor is placed → `splitAtWord(group, cursorPos)`. Otherwise → `splitAtTime(group, currentTime)` (splits at the playhead). Label and aria-label change to "Split here" when a cursor exists. |
| **Merge ↑** | `selectedGroupIdx > 0` | `mergeUpAtCursor(idx, cursorPosition)` — words `[0..N-1]` move into the previous group, `[N..end]` stay. With no cursor, the whole group merges up. |
| **Merge ↓** | `selectedGroupIdx < length-1` | `mergeDownAtCursor(idx, cursorPosition)` — `[0..N-1]` stay, `[N..end]` move into the next group. |

### 6.3 Row list (`CaptionEditorRow`)

Each row: play glyph + `m:ss` timestamp (mono, tabular) + text. Three visual states via the
`captionRow` CVA variant: `idle` / `selected` / `active` (active = playhead inside `[start, end)`).

- **Tap a row** → selects it *and* seeks playback to `group.start`.
- **Enter/Space** → same.
- Auto-scroll: the active row is `scrollIntoView({ block: 'nearest' })` — keyed on the *resolved
  index* so incidental re-renders don't yank a manual scroll.

**When selected**, the row expands into per-word controls:

| Affordance | Behaviour |
|---|---|
| **Split cursor** (thin caret between words, positions 1..n-1) | Tap to place; tap again to clear. Placed cursor renders as a blinking primary-colored caret. Hover shows a faint `white/20` ghost. This is what turns "Split" into "Split here". |
| **Accent word toggle** | Only when the active caption preset has `fontTreatment: 'accent-swap'` — i.e. `word-pop`, `big-statement`, `script-accent`. Tap a word to toggle it into `accentWordIndices`; accented words render `bg-primary/20 text-primary`. For all other presets, words are plain non-interactive spans. |

### 6.4 Keyboard (`useCaptionEditorShortcuts`)
Global: Escape → `clearSelection`; ⌘/Ctrl+Z → undo; ⌘/Ctrl+Shift+Z → redo.

---

## 7. Category: **Edit Style** (`StyleControls`)

Five tabs, order fixed: `animation · colors · font · spacing · visual`. Tab body slides
horizontally (±14px, 200ms) in the direction of travel; respects `prefers-reduced-motion`.
All fonts are preloaded via `loadFont` on mount so previews render in their real typeface.

### 7.1 Tab — **Animation**

Four options from `CAPTION_ANIMATIONS`. Each row: label + hint + checkmark pill.

| Label | Hint | Applies styleId | Mechanic |
|---|---|---|---|
| **Reveal** | "Sentence holds, each word lights as spoken" | `editorial-reveal` | `progressive-reveal` |
| **Pop** | "One word at a time" | `word-pop` | `word-swap` |
| **Cut** | "Short phrase, hard cut" | `minimal-lower-third` | `phrase-cut` |
| **Karaoke** | "Block holds, highlight moves word to word" | `karaoke-chip` | `static-highlight` |

Selection is matched on **mechanic**, not styleId — so a Director look running a specialised bundle
(`bold-outline`, `cream-block`, …) still highlights the right animation. Eight style bundles exist
in the engine; only four are directly selectable.

### 7.2 Tab — **Colors**

| Control | Writes | Notes |
|---|---|---|
| **Waveform** ColorRow | `style.waveColor` | native `<input type="color">`, swatch + hex label |
| **Background color** ColorRow | `style.backgroundColor` **and** `style.background = {type:'solid'}` | picking a color reverts a video/image background |
| **Text** ColorRow | `style.textColor` | |
| **Backdrop** segmented control | local `bgSource` only | Three tabs: **Artwork** / **Video** / **Image**. Switching tabs browses without changing the canvas. Seeded from the current background type on mount. |

**Conditional controls** — only render when the active preset declares them:

| Appears when | Controls |
|---|---|
| `preset.stroke` (`bold-outline`) | **Stroke** color + **Stroke width** slider (0–8, shown as %, "Thin"↔"Thick") |
| `preset.glow` (`script-accent`) | **Glow** color + **Glow intensity** slider (0–1, shown as %, "Subtle"↔"Strong") |

#### Backdrop → **Artwork** (`CanvasPresetPicker`)
Horizontal strip of 64×64 tiles, 20 curated SVG presets: Bow, Dwell, Foundation, Generation, Inner,
Jux, Kin, Kin2, Radient, Ray, Relative, Release, Reveal, Rise, Solace, Tamber, Tility, Tone, Unison,
Zip. Selected tile gets `border-white/80`.

**Unique behaviour**: selecting a preset sets `background` **and** `style.accentColor` together
(each preset ships a paired accent). Tapping the selected tile again deselects → back to solid +
`accentColor: undefined`. Not gated.

#### Backdrop → **Video** (`BackgroundVideoPicker`)
Strip of 64×64 tiles: 3 curated loops (**Café meeting**, **Podcast mic**, **Friends talking**) +
the user's custom uploads + a dashed **+** upload tile.

- Requires WebCodecs. Without it: everything disabled at 40% opacity + "Not supported on this browser".
- Tap selected tile again → deselect back to solid.
- **Preview is free; export is gated.** `handleExport` checks `background.type === 'video'` against
  `background_video` and bails to the upgrade sheet. Deliberate desire-driver.
- **Upload** is gated on `background_upload`. Flow: `transcodeBackgroundUpload` (progress 0→80%) →
  `generateUploadUrl` (85%) → POST as `video/mp4` (95%) → `uploadBackground` mutation (100%) → auto-select
  + "Background added" toast. Tile shows live `NN%`. Errors → toast.

#### Backdrop → **Image** (`BackgroundImagePicker`)
No curated library — user uploads only, plus the **+** tile.
- Accepts `image/jpeg`, `image/png`, `image/webp`. Max **4 MB**. Both validated client-side with toasts.
- No transcode step; direct POST → mutation → auto-select.
- Upload gated on `background_upload`. Selection itself is **not** export-gated (unlike video).
- Animated GIF is explicitly deferred.

### 7.3 Tab — **Font**

**2-column grid of 11 font rows.** Each row renders its own name in its own typeface + a semantic
label (hidden below 380px) + checkmark.

| Font | Label | Gate |
|---|---|---|
| Inter | Neutral | — |
| Roboto | Clean | — |
| Outfit | Rounded | — |
| Poppins | Modern | 🔒 `font_poppins` |
| Montserrat | Editorial | 🔒 `font_montserrat` |
| Space Grotesk | Technical | 🔒 `font_space_grotesk` |
| DM Sans | Soft | 🔒 `font_dm_sans` |
| Playfair Display | Display | 🔒 `font_playfair` |
| Lora | Serif | — |
| Instrument Serif | Cinematic | — |
| Instrument Sans | Grotesk | — |

Below: **Font size** slider — `32–96px`, step 1, value shown as `NNpx`, "Small"↔"Large".

### 7.4 Tab — **Spacing**

| Control | Type | Values |
|---|---|---|
| **Alignment** | 3-way segmented (`role="group"`) | `Start` / `Center` / `End` → `style.textAlign`, default `center` |
| **Position** | 4-way segmented | `Auto` / `Top` / `Middle` / `Bottom` → `style.verticalAlign`, default `auto`. "Auto" = each caption style's own waveform-aware placement. |
| **Line spacing** | Slider | `-0.6 … 1.4`, step 0.01, offset from a base of 1 → written as `lineHeight = max(0.4, 1 + v)`. "Tight"↔"Loose" |
| **Character spacing** | Slider | `-12 … 12px`, step 0.1 → `style.characterSpacing`. "Tighter"↔"Wider" |

### 7.5 Tab — **Visual**

Same seven options as the desktop Visual popover, as full-width rows:

| Option | Value | Gate |
|---|---|---|
| **Bars** | `waveformStyle: 'bars'` | — |
| **Orbit** | `'circle'` | 🔒 `waveform_circle` |
| **Spectrum** | `'spectrogram'` | 🔒 `waveform_spectrogram` |
| **Orb** | `'orb'` | — |
| **Baseline** | `'baseline'` | — |
| **Clean** | `'none'` | — |
| **Frames ›** | expands inline (`grid-rows` transition) to **Frame 1** / **Frame 2** → `graphicStyle` | — |

Selecting a waveform sets `graphicStyle = null`; selecting a frame sets `graphicStyle` and leaves
`waveformStyle` alone. Selected state: `graphicStyle !== null` for Frames, else
`graphicStyle === null && waveformStyle === value`.

**When the active preset has `ownsStage: true`** the whole tab is replaced by:
"Full-stage caption styles use the whole canvas — visual style doesn't apply."

---

## 8. Category: **Trim** (`TrimPanel`)

### 8.1 Timeline

- Label row: "Timeline" / "Drag handles to trim".
- 48px-tall canvas, 100 sampled waveform bars (`waveformSampler(audioBuffer, 100)`), drawn at
  `rgba(250,248,245,0.4)`, 80% of height.
- Regions outside `[startTime, endTime]` are dimmed with `rgba(0,0,0,0.6)`.
- Two 6px-wide primary-colored handles positioned by percentage.
- **Interaction**: pointer-down anywhere picks the *nearer* handle (no separate hit targets); drag
  moves it; handles are clamped to keep ≥ 0.1s between them. On pointer-up, `onPreviewAt(lastTime)`
  plays a short audio preview at the new handle position.
- Timestamps `m:ss` under each end.

### 8.2 Detected pauses

- `detectSilentRegions(audioBuffer)`, computed asynchronously in an effect after render.
- Section only renders when regions exist. Label row: "Detected pauses" / "Tap to select".
- Each region is a mono chip: `m:ss · N.Ns`. Tap toggles it into `deletedSilenceRanges`.
- Selected chips flip to destructive styling with `line-through` and 50% opacity.

### 8.3 Actions row (always visible)

| Button | Enabled when | Action |
|---|---|---|
| **↩ Undo** | `past.length > 0` | Pop trim history, restore `{audioBuffer, transcript}` snapshot, reload playback, reset handles |
| **↪ Redo** | `future.length > 0` | Symmetric |
| **Clear** | only rendered when ≥ 1 silence chip is selected | `clearDeletions()` — drops all chip selections (not handles) |
| **Apply cuts** | handles moved **or** ≥ 1 chip selected | Destructive-styled. Runs `onCommit`. |

### 8.4 What "Apply cuts" actually does (`handleCommitTrim` in `ExportState`)

1. Bail if no `audioBuffer` or `!trimmer.hasChanges`.
2. `trimmer.getTrimmedAudio(audioBuffer, transcript)` → splices out head/tail + every deleted range,
   merging overlaps, returns `Float32Array[]` per channel. Bail if the result is empty.
3. `buildAudioBuffer(...)` → new `AudioBuffer` at the same sample rate.
4. `trimmer.getTrimmedTranscript(transcript)` → filters dropped words and **shifts every remaining
   word's `start`/`end` back** by head-trim + total deleted duration before it.
5. Push `{audioBuffer, transcript}` onto `past` (capped at **5**), clear `future`.
6. Write the new buffer + transcript to the stores, `playback.load(...)`, `trimmer.resetAll(newDuration)`.

This is **destructive to the in-memory buffer** — the only way back is the 5-step undo.

### 8.5 Dead affordance
`useAudioTrimmer` exposes `toggleWordDeletion` (per-word audio deletion). Nothing in the export
screen calls it — only `useStudioEdits` (desktop /studio) does. The plumbing for
"delete this word from the audio" exists end-to-end but has no UI here.

---

## 9. Category: **Reframe** (`FormatToggle`)

The sparsest panel — four buttons in a `role="radiogroup"`, 26vh sheet.

| Label | `format` | Canvas dimensions | Gate |
|---|---|---|---|
| **1:1** | `square` | 1080 × 1080 | — |
| **9:16** | `vertical` | 1080 × 1920 | 🔒 `format_vertical` |
| **16:9** | `horizontal` | 1920 × 1080 | 🔒 `format_horizontal` |
| **4:5** | `instagram` | 1080 × 1350 | 🔒 `format_instagram` |

- Uses the `optionBtn` CVA variant (`shape: 'rect'`, `tone: 'white'`).
- **Roving tabindex + arrow-key navigation**: ←/↑ and →/↓ wrap around, and *change the format as
  they move focus* (not just move focus).
- `setFormat` writes both `format` and the matching `style.width/height` in one store update.

**Known hole**: the lock badges render, but `onClick={() => setFormat(value)}` has **no gate check** —
tapping the button body applies a locked format. Only the badge itself calls `onLocked`. Compare
`StageControlBar`'s Stage button and `StyleControls`' Visual rows, which both guard the action.

---

## 10. Export flow — `ExportOverlay`

Full-screen `bg-black/60 backdrop-blur-2xl`, centered 340px card, spring entry.

**`handleExport` sequence:**
1. Bail if no `audioBuffer` or `transcript`.
2. If `background.type === 'video'` and `background_video` is locked → `onLocked` and stop.
3. `await onExportStart()` → billing gate (`useExportGate.checkAndConsume`). On refusal, sets
   `upgradeTarget = 'export_limit'` and stops.
4. Open the overlay.
5. Compute trimmed audio + trimmed transcript (uncommitted handle/chip state is applied here — you
   do **not** have to press "Apply cuts" before exporting).
6. Create an offscreen canvas at `getCanvasDimensions(format)`, fill with `backgroundColor`.
7. Temporarily swap `processingStore.transcript` to the trimmed version, `await exporter.startExport(...)`,
   restore the original in a `finally`.

**Three mutually exclusive overlay states:**

| State | Content |
|---|---|
| **Exporting** | 40px `NN%` numeral, 4px progress bar, "Creating your video…", **Cancel** (the only exit — backdrop is inert). Cancel calls `cancelExport()` + closes. |
| **Error** | Red alert text + **Close**. |
| **Success** | `ShareCard` preview (headline = first 8 transcript words, or "Say it out loud."), a 3-way variant tablist (**Acid** / **Sunset** / **Electric**, `acidPill` CVA), **Save video** (accent, triggers `onDownload`), **Done** (ghost, closes). |

`onDownload` builds an `<a download="ordio-<timestamp>.<ext}">` from `exportedUrl` and clicks it;
extension comes from `fileExtension(exportMimeType)`.

**`ExportFooter`** renders nothing unless `trimmer.isEmpty` (`startTime >= endTime`), in which case:
"No audio remaining — adjust trim handles to continue".

---

## 11. Feature gates reference

All gates resolve to tier `creator` (`lib/featureGates.ts`; ranks free 0 < creator 1 < pro 2).
`onLocked(key)` → `setUpgradeTarget(key)` → `UpgradeSheet` opens from `create/layout.tsx`.

| Key | Reached from |
|---|---|
| `waveform_circle` | Style → Visual → Orbit; desktop Visual popover |
| `waveform_spectrogram` | Style → Visual → Spectrum; desktop Visual popover |
| `font_poppins` / `font_montserrat` / `font_space_grotesk` / `font_dm_sans` / `font_playfair` | Style → Font |
| `format_vertical` / `format_horizontal` / `format_instagram` | Reframe (badge only — see §9) |
| `layout_flipped` | Canvas stage-flip button; desktop Stage toggle |
| `background_video` | **Export time only** — preview is free |
| `background_upload` | Video **+** tile and Image **+** tile |
| `director_reroll` | Director looks 1 & 2 + Reroll |
| `unlimited_exports` | via `useExportGate` → `upgradeTarget = 'export_limit'` |
| `enhance_clean` / `enhance_hd` | not on this screen (recording settings) |

`showWatermark = tier === 'free'` is passed to both the preview renderer and the exporter.

---

## 12. Desktop ↔ mobile divergence (things that only exist on one side)

| Capability | Mobile | Desktop |
|---|---|---|
| Direct it (Director) | Dock item 1 | ❌ absent |
| Reframe / format | Dock item 5 | ❌ absent (type exists, no trigger) |
| Visual picker | Style → Visual tab | StageControlBar popover |
| Animation picker | Style → Animation tab | StageControlBar select |
| Stage flip | canvas-anchored icon button | StageControlBar toggle |
| Panel container | expanding bottom sheet, tap-to-collapse, drag-to-dismiss | static side card, always open |
| Panel selection state | `mobilePanel` | separate `desktopPanel` — the two do not sync |

---

## 13. Rough edges worth deciding on during redesign

1. **`ExportHeader` uses inline style props** — the only violation of the CVA-only rule on this screen.
2. **Reframe's locked formats are applicable** — badge fires `onLocked`, button body doesn't guard.
3. **Two disconnected undo stacks** (captions 50 / trim 5) with two separate button pairs in two
   different panels, plus a third implicit "undo" (tap-again-to-deselect) on the background pickers.
4. **Duplicate option lists**: `DISPLAY_OPTIONS` and `GRAPHICS_OPTIONS` are declared *twice*, verbatim,
   in `StageControlBar.tsx` and `StyleControls.tsx`. `CAPTION_ANIMATIONS` was already extracted to
   `lib/captionAnimations.ts` to stop exactly this drift; the visual lists never got the same treatment.
5. **`StyleControls.tsx` is 667 lines** — well past the 400-line ceiling. Five tab bodies in one
   `renderActiveTab()` switch.
6. **Rotation is unclamped** while scale and offset are clamped.
7. **"Show captions" resets the transform** rather than restoring the prior scale/rotation/offset.
8. **Panel heights are viewport-relative** (`46vh`/`26vh`) while the dock is pixel-based — on short
   landscape viewports the open panel plus dock can exceed the viewport.
9. **Trim commit is destructive to the buffer** with only 5 undo steps and no visual diff of what
   was removed.
10. **Desktop has no way to reach Reframe or Director** despite both being core actions.

---

## 14. File map

| File | Lines | Role |
|---|---|---|
| `app/create/export/[sessionId]/page.tsx` | 176 | Data boundary, hydration, callbacks |
| `app/create/layout.tsx` | 76 | Auth gate, UpgradeSheet host |
| `states/ExportState/index.tsx` | 239 | Orchestrator, trim history, export sequence |
| `states/ExportState/ExportHeader.tsx` | 65 | Fixed top bar |
| `states/ExportState/ExportCanvas.tsx` | 59 | Stage column |
| `states/ExportState/ExportControls.tsx` | 204 | Dock + panel surface + desktop card |
| `states/ExportState/StageControlBar.tsx` | 231 | Desktop Visual/Animation/Stage |
| `states/ExportState/ExportOverlay.tsx` | 176 | Progress / error / success modal |
| `states/ExportState/ShareCard.tsx` | — | Success-card artwork |
| `states/ExportState/ExportFooter.tsx` | 22 | Trim-empty alert only |
| `states/ExportState/DiscardDialog.tsx` | 42 | Back confirmation |
| `ui/Dock.tsx` | 70 | Mobile tab bar |
| `ui/IconToolbar.tsx` | 79 | Desktop tab bar (3 items) |
| `soul/captions/CaptionEditor.tsx` | 176 | Caption panel |
| `soul/captions/editor/CaptionEditorHeader.tsx` | 123 | Undo/redo + split/merge toolbar |
| `soul/captions/editor/CaptionEditorRow.tsx` | 146 | Row + cursor + accent toggles |
| `soul/captions/StyleControls.tsx` | **667** | Five-tab style panel |
| `soul/captions/CanvasPresetPicker.tsx` | 81 | 20 artwork tiles |
| `soul/captions/BackgroundVideoPicker.tsx` | 210 | Curated loops + upload |
| `soul/captions/BackgroundImagePicker.tsx` | 164 | Image upload only |
| `soul/captions/DirectorSheet.tsx` | 140 | AI looks drawer |
| `soul/editor/TrimPanel.tsx` | 273 | Timeline + pauses + actions |
| `soul/shared/FormatToggle.tsx` | 79 | Four aspect ratios |
| `primitives/video/CanvasPreview.tsx` | 320 | Canvas + anchored controls |
| `primitives/video/PlaybackControls.tsx` | 131 | Transport |
| `primitives/video/canvas-preview/CanvasCaptionTransformOverlay.tsx` | 128 | Transform handles |
| `primitives/video/canvas-preview/useCaptionGesture.ts` | 210 | Move/resize/rotate + double-tap |
| `hooks/audio/useAudioTrimmer.ts` | 212 | Trim math |
| `hooks/playback/usePlayback.ts` | — | WebAudio transport |
| `lib/featureGates.ts` | 50 | Gate table |
| `lib/captionAnimations.ts` | 50 | Shared animation list |
| `stores/uiStore.ts` | 172 | Persisted style/format/layout |
| `packages/engine/src/captions/presets.ts` | 120 | 8 caption style bundles |
| `packages/engine/src/captions/lookPresets.ts` | — | 12 Director looks |
| `packages/engine/src/backgrounds/canvasPresets.ts` | — | 20 artwork presets |
| `packages/engine/src/backgrounds/backgroundLibrary.ts` | — | 3 curated video loops |
