# Export Stage Controls Cleanup — Design

## Problem

The mobile export screen (`ExportState`) has four independent, confirmed bugs plus one
design-system inconsistency, all found by reviewing a screen recording of the live app
against the source. They compound to make the export screen feel broken and
inconsistent compared to the rest of the app.

1. **Orphaned control row overflows off-screen.** `StageControlBar` (Visual style /
   Caption preset / Stage flip) sits directly below the canvas as a horizontally
   scrolling row (`overflow-x-auto`, scrollbar hidden, no edge-fade). On a 16:9 canvas
   the "Stage" button gets hard-clipped at the viewport edge with zero affordance that
   it scrolls — it reads as broken, not scrollable. This is the row the user wants
   relocated.
2. **Whole-page scroll instead of a pinned canvas.** `ExportState/index.tsx` uses
   `min-h-dvh` on a stacked flex column (header → canvas → controls → footer) with no
   internal scroll region. On a tall export aspect ratio (4:5, 9:16) total content
   height exceeds one screen, so the entire page scrolls — including the header — to
   reach the playback bar, and iOS's rubber-band bounce fights the user because the
   overflow is only slightly taller than the viewport.
3. **Pause/Play icon barely visible.** `PlaybackControls.tsx` renders `griddy-icons`'
   `<Pause>`/`<Play>` bare. This icon library doesn't reliably inherit `currentColor`
   on fill — elsewhere in the codebase this is patched with
   `className="[&>path]:fill-current"` (see `CaptureDock.tsx`), but `PlaybackControls`
   never got the patch, so the icon renders near-invisible against the black canvas.
4. **Sheet close buttons sit flush in the corner.** `DirectorSheet.tsx:75` and
   `RecordingSettingsSheet.tsx:53` both use `absolute right-0 top-0` for their close
   button, an exact duplicated pattern with zero inset from the sheet edge.
5. **Mobile panel's grab handle is decorative.** The dock-grown panel that
   Captions/Edit Style/Trim/Reframe expand into (`ExportControls.tsx:108-170`) shows a
   grabber handle implying swipe-to-dismiss, but it's a pure CSS
   `grid-template-rows` height animation — tap-only close, no drag/pan gesture wired.

**Not a bug:** the lime-green (`--acid-accent`, #C6FF3D) on the playback progress fill
and the Reframe sheet's selected pill is the same design token, applied consistently.
That's the app's actual brand accent working as intended, not a stray color.

**Separately, three icon libraries are in play**: `griddy-icons` (6 files, older,
capture/recording flow), `@hugeicons/core-free-icons` (9 files, newer, dock items and
style controls), and raw `/icons/*.svg` image assets (both sheet close buttons). This
is real, user-confirmed inconsistency, addressed below alongside the other fixes.

## Decisions made

- **Visual style + Caption preset merge into `StyleControls` as new tabs — no new
  dock item.** Revised after a pressure-test pass (see below): putting Caption preset
  in a separate `Display` panel would have split one decision ("how do my captions
  look") across two dock items, since `StyleControls`'s existing Colors/Font/Spacing
  tabs already fine-tune caption color/font/spacing. Dock stays at **5 items**
  (`Direct it / Captions / Edit Style / Trim / Reframe`) — nothing added.
- **Stage flip becomes a direct one-tap icon anchored to the canvas, not a panel.**
  It's a binary layout toggle (Upper/Lower), not a style choice, and doesn't warrant
  opening a sheet for one on/off decision. Placing it on/near the canvas itself (not
  the dock) also fits its role as a canvas-layout property rather than a content or
  style control, and cleanly resolves the original complaint — this control moves
  fully off the below-canvas row instead of relocating into another crowded surface.
- **Background pickers consolidate into one segmented section; Gradient is removed
  entirely.** Confirmed with the user despite Gradient being a paid (Creator-tier)
  feature — this is a deliberate call to cut that surface, not just a presentation
  fix. See section 3 below.
- **Desktop is out of scope.** `StageControlBar` continues to render unchanged on
  desktop (`hidden md:flex`); the user's complaints are specifically about the mobile
  export flow and desktop isn't broken.
- **Icon library target: `hugeicons`, not `griddy-icons`.** Confirmed with the user.
  `hugeicons` is already the dominant library in newer code and doesn't have the
  `currentColor` bug. All `griddy-icons` usage across the app migrates to verified
  `hugeicons` equivalents (table below). This subsumes fix #3 — instead of patching
  `PlaybackControls`'s Play/Pause with `fill-current`, it migrates to
  `PlayIcon`/`PauseIcon` from `hugeicons` directly, which needs no such patch.
- **Scope: all fixes ship together** (control relocation, pinned canvas, icon
  migration, sheet close-button inset, drag-to-dismiss, panel sizing, background
  consolidation). Confirmed with the user — they touch overlapping files and are more
  coherent as one pass than staggered.

## Pressure-test findings (background pickers + panel sizing)

Two things surfaced after the initial design was drafted, both from re-examining the
actual component tree rather than taking the first pass at face value:

**Panel height is fixed regardless of content density.** The dock-grown panel
(`ExportControls.tsx`) is `h-[46vh]` for every panel. `Captions` and `Edit Style` are
dense enough to use that space; `Reframe` (`FormatToggle`, 4 aspect-ratio pills) leaves
a large dead empty area below its content. Recommendation (product-manager
evaluation): **two fixed height tiers, not continuous morph-to-content.** Continuous
morphing would need a `ResizeObserver` + measured-height animation, and would make
`StyleControls`'s own internal tab-switching (Colors/Font/Spacing, now also
Preset/Visual) visibly resize the sheet on every tab tap — worse than the current
problem. Two discrete tiers (compact ~24–28vh for `Reframe`; full 46vh, unchanged, for
`Captions`/`Edit Style`/`Trim`) mirrors how native iOS sheets use a small fixed set of
detents rather than per-pixel sizing, needs no new animation system (same
`grid-rows` swap, just a different target height per panel id), and as a side benefit
puts short option lists closer to the thumb.

**The "Colors" tab in `StyleControls` is overloaded with four near-identical
background pickers.** Under solid Waveform/Background/Text color rows, it stacks
`CanvasPresetPicker`, `GradientBackgroundPicker`, `BackgroundVideoPicker`, and
`BackgroundImagePicker` — four separately-labeled horizontal-scroll thumbnail strips
(each ~64px tiles), all under a tab literally called "Colors" even though three of
the four aren't colors at all. Confirmed: even the tile CSS class (`TILE_CLASS`) is
copy-pasted identically across all four files. User confirmed removing Gradient
entirely (it's currently `background_gradient`-gated, Creator-tier) and consolidating
the rest.

## Design

### 1. Control relocation — no new dock item

- `StyleControls.tsx` gains two new tabs, extending `STYLE_TABS` from
  `['colors', 'font', 'spacing']` to `['preset', 'colors', 'font', 'spacing',
  'visual']`. `preset` goes first — the caption preset (`CaptionStyleId`) already
  determines whether the `colors` tab shows Stroke/Glow rows
  (`activeStylePreset.stroke`/`.glow`), so picking the overall look before refining
  colors is the correct sequence, not an arbitrary one.
  - **Preset tab:** the `MODE_OPTIONS` list (Pop/Outline/Karaoke/Minimal/
    Statement/Script) currently in `StageControlBar`'s `Select`, rendered as full-width
    rows matching `FontRow`'s selected/locked visual treatment.
  - **Visual tab:** the `DISPLAY_OPTIONS` list (Bars/Orbit/Spectrum/Clean/Frames) from
    `StageControlBar`'s `Popover`, including the nested Frame1/Frame2 expand-in-place
    behavior — same `grid-template-rows` expand pattern, relocated as-is (content
    duplicated into the new tab, not moved — see next bullet for why the original
    stays intact).
- `StageControlBar.tsx` itself is **not deleted** — consistent with "Desktop is out
  of scope" above, it keeps rendering unchanged on desktop. In `ExportCanvas.tsx`,
  its wrapper gets `hidden md:flex` so mobile stops rendering the row entirely (this
  alone fixes the horizontal-overflow bug there) while desktop is untouched.
- **Stage flip**, on mobile, becomes a small icon button anchored to the canvas
  itself (e.g. top corner, clear of the Export button in the header), not a
  dock/panel control. Tap flips `canvasLayout` immediately — same `handleFlipStage`
  logic `StageControlBar` already has, no sheet opens. Exact anchor position is a
  build-time visual call; must not overlap canvas content or header controls at any
  of the 4 export aspect ratios. Desktop keeps using `StageControlBar`'s existing
  Stage toggle, unchanged.
- Desktop bonus: `StyleControls` already renders there via the sidebar `IconToolbar`
  (`desktopPanel === 'style'`), so the two new tabs (Preset, Visual) appear on
  desktop automatically — meaning desktop temporarily has the Visual/Caption-preset
  choice in two places (new tabs + the untouched `StageControlBar` row). Acceptable
  since desktop is explicitly out of scope for this pass; worth a follow-up to remove
  the duplication there later, not now.

### 2. Pinned canvas, internally-scrolling content

- `ExportState/index.tsx` root: on mobile, replace `min-h-dvh` flex-col growth with a
  fixed-height shell — header stays `shrink-0`, the canvas+playback region becomes
  `flex-1 min-h-0 overflow-y-auto` with bottom padding reserved for the fixed dock's
  height so content can't hide behind it.
- Net effect: the header no longer scrolls away, and any overflow (extreme aspect
  ratios) scrolls only within that inner region — eliminating the whole-page
  rubber-band bounce.
- Desktop (`md:` layout, side-by-side canvas + sidebar panel) is unaffected — this
  fix is scoped to the mobile single-column layout.

### 3. Icon library migration (griddy-icons → hugeicons)

Full verified mapping (each `hugeicons` name confirmed to exist in the installed
`@hugeicons/core-free-icons` package):

| File | griddy-icons import | hugeicons replacement |
|---|---|---|
| `PlaybackControls.tsx` | `Play`, `Pause` | `PlayIcon`, `PauseIcon` |
| `CaptureDock.tsx` | `Upload`, `Settings`, `Stop`, `Pause`, `Play`, `Refresh`, `Close`, `Microphone` | `Upload01Icon`, `Settings01Icon`, `StopIcon`, `PauseIcon`, `PlayIcon`, `RefreshIcon`, `Cancel01Icon`, `Mic01Icon` |
| `UploadActionSheet.tsx` | `Image`, `VideoCamera`, `File` | `Image01Icon`, `Video01Icon`, `File01Icon` |
| `CaptureHeader.tsx` | `Menu`, `ArrowLeft` | `Menu01Icon`, `ArrowLeft01Icon` |
| `LeftRail.tsx` | `Trash` | `Delete01Icon` |
| `CaptureSidebar.tsx` | `Search`, `Plus`, `Settings`, `Trash` | `Search01Icon`, `PlusSignIcon`, `Settings01Icon`, `Delete01Icon` |

- Existing `[&>path]:fill-current` patches (`CaptureDock.tsx:102,162`) get removed —
  `HugeiconsIcon` inherits color via `strokeWidth` + `currentColor` natively, no patch
  needed.
- `HugeiconsIcon` takes a different prop API than `griddy-icons` components
  (`<HugeiconsIcon icon={PlayIcon} size={16} strokeWidth={2} />` vs `<Play size={16}
  />`) — every call site's props need updating, not just the import.
- **Known visual consequence:** `hugeicons` is outline/stroke-style, `griddy-icons` is
  filled/solid. This changes icon weight everywhere it's used, not just which SVG
  renders. Needs a visual pass after implementation to confirm nothing reads as
  visually broken (e.g. thin lines disappearing at small sizes against busy
  backgrounds).
- Both sheet close buttons (`DirectorSheet.tsx`, `RecordingSettingsSheet.tsx`) swap
  their `<Image src="/icons/close.svg" .../>` for `Cancel01Icon` as part of this same
  migration, for consistency with the rest of the icon system.

### 4. Sheet close-button inset

- `DirectorSheet.tsx:75` and `RecordingSettingsSheet.tsx:53`: change
  `absolute right-0 top-0` → `absolute right-1 top-1` (4px inset on both axes,
  Tailwind's `1` unit = 0.25rem = 4px, exact match to the requested amount).
- Both are exact duplicates of the same block — fix identically in both files.

### 5. Real drag-to-dismiss on the dock panel

- Wire `framer-motion`'s `drag="y"` (already a project dependency, already used
  adjacent to this exact code via `StyleControls.tsx`) onto the growing panel in
  `ExportControls.tsx`, scoped to the handle/header area so it doesn't fight
  scrollable content inside (`TrimPanel`, `StyleControls` both scroll internally).
- `onDragEnd`: if dragged down past a threshold, call the same `setDrawerOpen(false)`
  the tap-handle already uses — no new close path, just a second way to trigger it.
- This fixes it once for all five dock panels, since they all share this one
  growing-panel container.

### 6. Two-tier panel height

- `ExportControls.tsx`'s growing panel gets a per-panel height lookup instead of a
  hardcoded `h-[46vh]`: `reframe` → compact (~24–28vh, exact value a build-time visual
  call), everything else (`captions`, `style`, `trim`) → full (46vh, unchanged).
- Implementation stays inside the existing `grid-template-rows` mechanism — just a
  different `h-*`/max-height class picked by `mobilePanel` id, no `ResizeObserver`,
  no measured-height animation.

### 7. Background picker consolidation

- `GradientBackgroundPicker.tsx` is deleted. Its `background_gradient` feature gate
  (`featureGates.ts`) and the `isLocked('background_gradient')` check in
  `ExportState/index.tsx`'s `handleExport` are removed along with it — this is a
  monetization-surface removal, not just a UI change, per the decision above.
- `CanvasPresetPicker`, `BackgroundVideoPicker`, and `BackgroundImagePicker` merge
  under one "Background" section in the `colors` tab, switched by a small segmented
  control (`Preset | Video | Image`) instead of three permanently-stacked labeled
  strips — same pattern `StyleControls` already uses for its own top-level tabs, so
  no new UI primitive. Each option's existing tile-strip content (and its
  duplicated `TILE_CLASS`) can consolidate into one shared row component at
  implementation time, since the three are now siblings under one switcher rather
  than three independently-coded sections.
- Net effect on the `colors` tab: Waveform/Background/Text solid-color rows, then one
  "Background" segmented section (3 options instead of 4 stacked strips), then the
  conditional Stroke/Glow rows — meaningfully shorter and no longer mislabeled (three
  of four background sources living under a tab called "Colors" was the original
  complaint).

## Out of scope

- Desktop export layout (`StageControlBar`, desktop sidebar panel) — untouched.
- `DirectorSheet`'s own drag-to-dismiss — it's a real `vaul` `Drawer` and should
  inherit the library's default swipe behavior; not verified live in this pass since
  the screen recording only covered the Reframe panel. If it's still broken after
  this pass, that's a separate, narrower investigation (likely the scrollable content
  div intercepting touch before vaul's handler sees it).
- Any icon *variant* choice left ambiguous by this doc (e.g. `Settings01Icon` vs
  `Settings02Icon`) is a build-time visual call — implementer should hold both up
  against the existing dock icons and pick whichever matches stroke weight/style
  most closely, not necessarily the first name in the table.

## Testing

- Manual mobile QA (real device or `/browse` at mobile viewport) after implementation:
  export screen at each of the 4 aspect ratios (1:1, 9:16, 16:9, 4:5), confirming no
  page-level scroll/bounce, the new Preset/Visual tabs work in `StyleControls`, and
  the canvas-anchored Stage-flip icon doesn't overlap anything at any ratio.
  Auth blocked headless testing this session (Clerk dev keys mismatched, unrelated to
  this work) — flag if still blocked when this is implemented.
- Confirm the Gradient removal doesn't leave orphaned state: existing projects with
  `style.background.type === 'gradient'` already saved need a sane fallback (e.g.
  revert to solid) rather than rendering nothing.
- Visual check of every migrated icon at its actual render size against its actual
  background, given the outline-vs-fill weight change noted above.
- Confirm drag-to-dismiss works on both a compact panel (Reframe) and a full panel
  (Edit Style), and that it doesn't accidentally trigger while scrolling
  `TrimPanel`/`StyleControls` content.
