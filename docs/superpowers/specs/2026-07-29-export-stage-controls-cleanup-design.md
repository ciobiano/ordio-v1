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

- **New home for Visual/Caption/Stage controls:** a 6th dock item, `Display`, added to
  the existing mobile dock (`Direct it / Captions / Edit Style / Trim / Reframe`),
  reusing the exact panel-grow mechanism already used by the other five. Chosen over a
  novel floating/expanding button because it introduces zero new interaction pattern
  and automatically inherits the drag-to-dismiss fix in item 5.
- **Desktop is out of scope.** `StageControlBar` continues to render unchanged on
  desktop (`hidden md:flex`); the user's complaints are specifically about the mobile
  export flow and desktop isn't broken.
- **Icon library target: `hugeicons`, not `griddy-icons`.** Confirmed with the user.
  `hugeicons` is already the dominant library in newer code and doesn't have the
  `currentColor` bug. All `griddy-icons` usage across the app migrates to verified
  `hugeicons` equivalents (table below). This subsumes fix #3 — instead of patching
  `PlaybackControls`'s Play/Pause with `fill-current`, it migrates to
  `PlayIcon`/`PauseIcon` from `hugeicons` directly, which needs no such patch.
- **Scope: all six fixes ship together** (dock consolidation, pinned canvas, icon
  migration, sheet close-button inset, drag-to-dismiss). Confirmed with the user —
  they touch overlapping files and are more coherent as one pass than staggered.

## Design

### 1. Dock consolidation — new "Display" panel

- Add `{ id: 'display', label: 'Display', icon: <hugeicons equivalent, TBD at build
  time — Settings01Icon or similar, picked to visually match the other 5 dock icons> }`
  to `DOCK_ITEMS` in `ExportControls.tsx`.
- Extract the three controls currently in `StageControlBar.tsx` (Visual style popover,
  Caption preset select, Stage flip toggle) into a new `DisplayControls.tsx`,
  restyled as full-width vertical rows (matching `StyleControls.tsx`'s row layout)
  instead of horizontally-scrolling pills, since it now renders inside the existing
  `h-[46vh]` scrollable dock panel instead of a below-canvas strip.
- `mobilePanel` state type (`ToolbarPanel`) gains `'display'`; render
  `<DisplayControls onLocked={onLocked} />` when `mobilePanel === 'display'`.
- In `ExportCanvas.tsx`, wrap the existing `<StageControlBar onLocked={onLocked} />`
  render with `hidden md:flex` so desktop is untouched and mobile no longer shows the
  below-canvas row at all.

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
- This fixes it once for all six dock panels (five existing + the new Display panel),
  since they all share this one growing-panel container.

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
  page-level scroll/bounce and the Display panel is reachable without overflow.
  Auth blocked headless testing this session (Clerk dev keys mismatched, unrelated to
  this work) — flag if still blocked when this is implemented.
- Visual check of every migrated icon at its actual render size against its actual
  background, given the outline-vs-fill weight change noted above.
- Confirm drag-to-dismiss works on the Display panel and at least one existing panel
  (e.g. Reframe), and that it doesn't accidentally trigger while scrolling
  `TrimPanel`/`StyleControls` content.
