# Sheet Color Hierarchy Redesign

**Date:** 2026-03-16
**Scope:** `RecordingSettingsSheet` + `UpgradeSheet` only — no other components touched
**Branch:** v2

---

## Problem

The existing sheets have three systemic issues:

1. **No elevation** — `bg-black` on both sheets is identical to the page background, so sheets visually blend into the app rather than floating above it.
2. **Invisible borders and surfaces** — `--border: rgba(255,255,255,0.06)` and `--surface-sheet: rgba(255,255,255,0.03)` are imperceptibly faint, providing no structural hierarchy.
3. **Weak section labels and active states** — Section headers use `--text-footnote` at 500 weight and 35% opacity; selected states use 12% white fill — neither communicates clear hierarchy.

---

## Design Decisions

### Material: Apple Dark Glass
Sheets use Apple's dark material system — semi-transparent dark fill with backdrop blur, a specular top-edge border, and subtle side borders. This gives the sheet physical depth and lets the orb's warm gradients bleed faintly through the frosted surface.

`rgba(18, 18, 20, 0.72)` at 72% opacity over a black background yields an effective near-black — verified sufficient contrast without blur for `backdrop-filter` graceful degradation.

### Rounding: Playful Apple
- Sheet top radius: `24px` (up from `16px`)
- Control radius: `12px` / `rounded-xl` (up from `8px`)
- Taller touch targets: `9px` vertical padding on each segmented control item button

### Active State: Subtle Grey
No color tint. Active fill is `rgba(255,255,255,0.20)` — a brighter region of the same frosted surface, like light catching thicker glass. Works stably against any warm/cool orb bleed-through without competing with the material.

### Close Button
`RecordingSettingsSheet` adds an explicit X dismiss button — 28px visual circle, 44px tap area via `p-[8px]` negative-space padding, anchored top-right in the header row. `UpgradeSheet` omits the X — "Maybe later" ghost button already serves dismiss.

---

## New CSS Tokens

Add to `globals.css` `:root` block only. All tokens are consumed via Tailwind 4 arbitrary value syntax (`bg-[--surface-glass]`, `border-[--border-glass]`) — no `@theme inline` registration required for arbitrary value usage.

```css
/* Glass surface tokens — sheet components only */
--surface-glass:      rgba(18, 18, 20, 0.72);   /* RecordingSettingsSheet bg */
--surface-glass-card: rgba(18, 18, 20, 0.78);   /* UpgradeSheet card bg */
--border-glass:       rgba(255, 255, 255, 0.16); /* specular top/all-around edge */
--shadow-glass-top:   inset 0 1px 0 rgba(255, 255, 255, 0.12); /* UpgradeSheet inner highlight */
--surface-selected:   rgba(255, 255, 255, 0.20); /* active segment / selected radio row */
```

Note: `--border-glass-side` (rgba 6%) is dropped — `border-x border-white/[0.06]` as an arbitrary value inline is clearer for a single-use edge case and avoids a token with only one consumer.

---

## RecordingSettingsSheet Changes

### Sheet container
```
bg-[--surface-glass]
backdrop-blur-[40px] backdrop-saturate-[160%]
rounded-t-[24px]
border-t border-[--border-glass]
border-x border-white/[0.06]
```

### Drag handle
```
w-10 h-[5px] rounded-full bg-white/[0.28]   ← was: w-9 h-1 bg-[--surface-hover]
```

### Close button (new element)
28px visual circle, 44px tap area. Tap area and visual affordance are separated: the `<button>` owns the 44px hit target; an inner `<span>` owns the visible circle. `group-hover` proxies the hover state from button to span.

```html
<button
  aria-label="Close settings"
  onClick={onClose}
  className="
    absolute right-0 top-0
    min-w-[44px] min-h-[44px]
    flex items-center justify-center
    group cursor-pointer rounded-full
    focus-visible:ring-2 focus-visible:ring-white/60
    focus-visible:ring-offset-2 focus-visible:ring-offset-black
  "
>
  <span className="
    w-7 h-7 rounded-full
    bg-white/10 border border-white/10
    flex items-center justify-center
    group-hover:bg-white/[0.15] transition-colors duration-150
  ">
    <XIcon className="w-3 h-3 text-white/55" strokeWidth={2} />
  </span>
</button>
```
Button is 44×44px minimum. Visual span is 28px (w-7 h-7). `group-hover` on the span proxies hover from the full tap area to the visual circle.

### Section labels
```
text-[length:var(--text-footnote)] font-semibold    ← was: font-medium
text-white/[0.48] uppercase tracking-[0.13em]        ← was: text-[--secondary] (50%)
```

### SegmentedControl wrapper
```
rounded-xl border border-[--border] overflow-hidden  ← was: rounded-lg
```

Each segment item `<button>`:
```
py-[9px]                                             ← was: py-2
active: bg-[--surface-selected] text-[--primary]    ← was: bg-[--surface-active] (12%)
inactive: text-[--secondary] hover:bg-[--surface] hover:text-[--primary]
```
`py-[9px]` is applied to the individual segment `<button>` elements inside the `SegmentedControl` component, not the wrapper div.

### Radio rows (Audio Enhancement)
```
Selected row:    bg-[--surface-selected]             ← was: no bg
Radio dot checked: border-white/70 bg-white/70       ← was: border-[--primary] bg-[--primary]
Inner dot:       bg-[rgba(18,18,20)]                 ← matched to glass bg for contrast
```

### Section dividers
```
h-px bg-white/[0.08]                                 ← was: bg-[--border] (6%), missing h-px
```

---

## UpgradeSheet Changes

### Card container
`box-shadow` is applied via CSS custom property to respect the no-inline-styles rule:
```
bg-[--surface-glass-card]
backdrop-blur-[40px] backdrop-saturate-[160%]
border border-[--border-glass]                        ← was: border-[--border] (6%)
shadow-2xl [box-shadow:var(--shadow-glass-top)]       ← inner specular highlight via token
rounded-3xl                                           ← unchanged (24px)
```

### Drag handle
```
w-9 h-[5px] rounded-full bg-white/[0.25]             ← was: w-8 h-1 bg-white/20
```

---

## What Does Not Change

- All other soul components (`IdleState`, `RecordingState`, `ProcessingState`, `ExportState`, `StyleControls`, `CaptionEditor`)
- All primitive components
- `globals.css` existing tokens — additions only, no modifications
- `variants.ts` — no changes
- Landing page components

---

## File Changelist

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | Add 4 new CSS custom properties to `:root` |
| `apps/web/src/components/soul/RecordingSettingsSheet.tsx` | Glass bg, new radius, drag handle, close button, segmented control, radio styles, divider `h-px` |
| `apps/web/src/components/soul/UpgradeSheet.tsx` | Glass card bg, `--border-glass` border, `--shadow-glass-top`, drag handle |

---

## Success Criteria

- Sheet visually floats above app content — no blending with page background
- Active segment and selected radio row are unambiguously distinguishable from inactive
- Close button has 44px tap area (`p-[8px]` + `w-3 h-3` icon = 28px visual, 44px touch)
- Close button has visible `focus-visible` ring for keyboard navigation
- `backdrop-filter` degrades gracefully — `bg-[--surface-glass]` at 72% opacity over black is verified sufficient contrast without blur
- No regressions in other components
