# Ordio Design System

> The contract for the ACID system. Tokens live in `apps/web/src/app/globals.css`;
> component variants in `apps/web/src/lib/ordioVariants.ts` and `lib/variants.ts`.
> This file says what they *mean*. If a colour appears on screen and you cannot
> point at the rule below that licenses it, it is a bug.

**Aesthetic:** bold consumer / expressive creator-social. Ink base, one electric
lime signature. Not restraint — but not noise either: the energy comes from
scarcity and weight, never from spreading the accent around.

---

## 1. The one rule

**Lime marks a value the user chose, or the one action that commits it. Nothing else.**

Everything a colour system usually does with hue — hierarchy, position, grouping,
emphasis, surface — is done here with **one ink at four opacities** and **white at
four alphas**. That is the whole system. Lime is the exception you earn.

### Why this is stricter than a typical accent rule

| | luminance (L\*) |
|---|---|
| iOS `systemBlue` `#007AFF` | ~48 |
| Ordio paper `#f4f5ef` | ~96 |
| **Ordio lime `#c6ff3d`** | **~92** |

A conventional accent is *mid*-luminance, so it reads as coloured while still
ranking clearly **below** the primary text. Lime has no such headroom — it is
within 4 points of paper white. It cannot rank below paper by brightness, so two
lime objects and a white heading all compete as equals.

Lime therefore cannot earn attention by contrast. **It earns attention by being
the rarest thing on the screen.** Target: **one to three lime objects per
viewport.** If you count more, the screen is wrong, not the eye.

---

## 2. Ink — hierarchy

One hue, four weights. This carries *all* type hierarchy. Never introduce a fifth
step; never tint ink toward the accent.

| Token | Value | Use |
|---|---|---|
| `--acid-text-1` | `#f4f5ef` | Headings, **active navigation**, set values, primary glyphs |
| `--acid-text-2` | 64% | Field labels, body copy |
| `--acid-text-3` | 42% | Hints, meta, **inactive navigation**, section eyebrows |
| `--acid-text-4` | 24% | Disabled text, dividers |

Backgrounds run the same discipline — an ink ladder, not a grey palette:

| Token | Value | Use |
|---|---|---|
| `--acid-bg-base` | `#0a0b0a` | The page. Also `--acid-on-accent` (text on lime). |
| `--acid-bg-subtle` | `#101110` | Recessed wells |
| `--acid-surface-1` | `#141517` | Sheets, drawers, dock (`--sheet-bg` aliases this) |
| `--acid-surface-2` | `#1c1d20` | Cards on a sheet |
| `--acid-surface-3` | `#26282b` | The highest raised card |

---

## 3. Fill — surfaces inside a surface

White at four alphas. Use these instead of another surface token when something
needs to read as inset within its parent rather than as a new layer.

```
white/0.05   resting field card, unselected option card
white/0.07   segmented track, chip at rest
white/0.10   hover, back button, secondary button face
white/0.18   toggle track (off)
```

Borders are the same idea: `--acid-border-subtle` (7%), `-default` (12%),
`-strong` (18%).

---

## 4. Lime — three treatments, never a scale

There is no `lime-100 … lime-900`. There is one lime and three ways to apply it.
Adding a shade is how the system rots.

| Treatment | Tokens | Means | Examples |
|---|---|---|---|
| **Solid** | `--acid-accent` bg + `--acid-on-accent` text | *This commits.* **One per screen.** | Export, Apply, Apply cuts |
| **Glyph** | `--acid-accent` as text/icon/fill | *This is the value you set.* | Slider fill, live value readout |
| **Wash** | `--acid-accent-soft` (14%) + solid `--acid-accent` rule | *This row holds your choice.* | Selected option card, emphasised word |

Plus `--acid-accent-ring` (40%) — focus only, never decoration.

### Focus is one ring, and it is lime

`--ring` resolves to `--acid-accent`, so every shadcn-derived primitive inherits
it. Focus is the one place the accent marks something that is neither a chosen
value nor a commit, because it is not decoration — it is the keyboard user's
cursor, and it has to be the loudest thing on screen while it exists.

**One indicator, never stacked.** The upstream primitives shipped
`focus-visible:border-ring` *and* `focus-visible:ring-[3px]` *and*
`focus-visible:outline-1` — up to three concentric marks, two of them neutral
grey because `--ring` defaulted to a zero-chroma value. Only the ring survives.
When adding a control: one `focus-visible:ring-*`, no border recolour, no
outline.

### Lime is banned from

- **Position.** Active tab, active dock item, current step. That is `--acid-text-1`
  against `--acid-text-3`; the open panel is already the strongest position signal
  there is, and a lime underline just doubles it in the loudest available colour.
- **Identity.** The wordmark, headers, chrome. Brand lives in the app icon and in
  the *work*, not in the furniture. A lime wordmark 12px from a lime Export button
  costs you the button.
- **Decoration.** Rules, dividers, icon accents, hover states, empty-state art.
- **Any screen whose content is colour.** The Colors tab shows swatches the user
  picked; lime chrome there competes with the only thing on screen that matters.
  Chrome yields to content, always.

### The `--acid-signal` gradient

`linear-gradient(90deg, #c6ff3d, #6be0ff)`. Reserved for exactly two things: the
single hero headline on a marketing screen, and the Orb's live-audio state. It is
not a wash, not a border, not a button.

---

## 5. Semantic roles

These are not palette entries you may reach for. Each has one job.

| Token | Value | Job |
|---|---|---|
| `--acid-premium` | aliases `--acid-warning` `#ffc24b` | Gated features only. Amber not red: a lock is an upsell, not a failure. |
| `--acid-error` | `#ff5c5c` | Destructive and failed only |
| `--acid-success` | `#7ce23d` | Confirmation only. **Note it is near-lime — never place it beside the accent.** |
| `--acid-info` | `#6be0ff` | Informational only |

---

## 6. Elevation — sticker vs flat

The sticker press is the signature: a **3px ink border**, a **hard offset shadow**
(`--acid-shadow-sticker` 6px / `-sm` 3px, no blur), and a press that **translates
3px into its own shadow** as the shadow vanishes. Physical movement, never a dim.

**A sticker needs a surface to peel off.** The shadow is `--acid-bg-base` (`#0a0b0a`),
which reads against the page and disappears against `--sheet-bg` (`#141517`) — on a
sheet you get the border reading as a gap and no peel at all. And a sheet is already
the raised layer; raising something on top of it is a second claim to the same depth.

| Context | Elevation | Press |
|---|---|---|
| On the canvas / page — Dock FAB, Export | `raised` | translate into shadow |
| Inside a sheet, drawer or panel | `flat` | `scale(0.97)` |

Encoded as the `elevation` variant on `ordStickerBtn`. Default is `raised`; sheets
pass `flat` explicitly so the choice is visible at the call site.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--acid-dur-tap` | 90ms | Colour and opacity on press |
| `--acid-dur-snap` | 220ms | Toggles, chips, selection |
| `--acid-ease-snap` | `cubic-bezier(0.2, 0.9, 0.1, 1)` | Chip select, sticker land |
| `--acid-ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Sheets rising |

**Sheets track the thumb 1:1** on the dismiss axis. A sheet that moves less than
your finger reads as broken, not as damped — resistance belongs at the *boundary*
(`dragElastic.top = 0`, a hard stop), never across the whole travel.

Animation is targeted, never blanket: hero entrance, timeline progress, named
accordion transitions, sheet gestures. No scroll-triggered fade wrappers.
Every animation honours `prefers-reduced-motion`.

---

## 8. Typography

Nunito, one family for display and body, loaded in `layout.tsx` as
`--font-acid-nunito` (400–900). **Weight** carries the display/body distinction,
not family.

Size, leading and tracking are **one triple per role** and are never mixed across
roles. Tracking follows the inverse-size rule: large type loosens by default and
needs negative tracking; small type reads cramped and needs positive.

| Role | Size | Leading | Tracking |
|---|---|---|---|
| `display` | 40 → 72px | 1 | −0.035em |
| `title` | 28 → 40px | 1.08 | −0.025em |
| `headline` | 22 → 26px | 1.25 | −0.015em |
| `body` | 15 → 17px | 1.55 | 0 |
| `label` | 13 → 14px | 1.4 | 0.005em |
| `caption` | 12 → 13px | 1.45 | 0.01em |
| `footnote` | 11 → 12px | 1.4 | 0.02em |
| `eyebrow` | (label size, caps) | 1.2 | 0.14em |

Sizes are `clamp()` so they are responsive at the token, not the breakpoint.
Tracking is in `em` so it stays proportional across the clamp range; leading is
unitless so nested elements inherit a ratio. **Both units are load-bearing — do
not convert them to px.**

One `display` line per screen, maximum.

---

## 9. Component inventory

Every variant is CVA in `lib/ordioVariants.ts`. No hardcoded Tailwind variant
strings in JSX, no arbitrary values — dynamic values go through CSS custom
properties, never inline `style` (the one sanctioned exception is a colour swatch
rendering a user-chosen hex, which cannot be a token by definition).

| Export | Component | Lime treatment when active |
|---|---|---|
| `ordStickerBtn` | Primary button | Solid — the commit |
| `ordGhostBtn` | Cancel / Reset / Done | None, ever |
| `ordSegmentTrack` / `ordSegmentBtn` | Alignment, Position, Capitalization | Solid — chosen value |
| `ordToggleTrack` / `ordToggleThumb` | Labelled switch | Solid — on-state |
| `ordOptionCard` / `ordCheckPill` | Motion, Visual rows; Font tiles | Wash + rule |
| `ordChip` | Breaks frequency, detected pauses | Solid — chosen value |
| `ordLockBadge` | Gated-control pin | Premium amber |
| `ordFieldCard` | Recessed well around a control group | — |
| `ordSectionLabel` | Caps structural label | Ink-3 |
| `ordFieldLabel` / `ordFieldHint` | Row label / secondary line | Ink-2 / Ink-3 |

### Gating contract

A locked control still fires its `onSelect`. The **caller** wraps that callback in
the feature gate, so the upgrade sheet opens from anywhere on the control rather
than only from the padlock. `LockPin` is decorative and non-interactive by design —
the older `ui/LockBadge` pattern covered its parent with `absolute inset-0` and
swallowed the click, which let a free user apply a locked option by tapping past
the badge.

---

## 10. Touch, layout and accessibility

- **44×44px minimum** on every interactive target. Several controls are drawn
  smaller than this by design (the 46×26 switch, the 34px swatch) — the target is
  then owned by the **row**, not the glyph. A control with `px-0` has a tap target
  the width of its text; that is always a bug.
- **Scrolling strips scroll on one axis.** `overflow-x: auto` alone computes
  `overflow-y: auto` too, per CSS — the other axis can never stay `visible`. Pair it
  with an explicit `overflow-y-hidden`, and keep active-state pseudo-elements
  *inside* the box or they will silently create a second scroll axis.
- A horizontally scrolling strip must **scroll its active item into view** when that
  item changes programmatically, or deep links land on something off-screen.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1. `--acid-text-4` is decorative and
  never carries meaning alone.
- State is never signalled by opacity — with one exception: **disabled is `0.4`**.
- Always `next/image`. Never a raw `<img>`.

---

## 11. Adding something new

1. Can ink + fill express it? Then use ink + fill. Stop here almost every time.
2. Is it a value the user chose, or the commit? Then it is lime — pick one of the
   three treatments, do not invent a fourth.
3. Is it gated, destructive, or a confirmation? Then it is a semantic role.
4. Otherwise it does not get a colour.

Then: put the variant in CVA, count the lime objects in the viewport, and check the
tap target.
