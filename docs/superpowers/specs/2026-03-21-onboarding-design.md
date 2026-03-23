# Onboarding Screen Design

**Date:** 2026-03-21
**Status:** Approved for implementation

---

## Overview

A first-time-only onboarding walkthrough for new Ordio users. Triggered automatically on first visit to `/create`. Displayed as a shadcn `Dialog` overlay over the blurred idle screen (Orb visible behind). Dismissed permanently via `localStorage`.

---

## Goals

- Reduce friction before recording — users should feel at ease before speaking
- Surface the style customisation feature (graphic frames, not just waveforms) which users miss
- Convey what Ordio does in under 60 seconds

---

## Approach: shadcn Dialog Overlay (Option B)

The onboarding renders as a `<Dialog>` that opens automatically when `localStorage.getItem('ordio_onboarded')` is falsy. The idle screen (Orb, wordmark) is visible but blurred behind the backdrop. No new phase is added to the state machine.

**Why Dialog over full-screen phase:**
- Less code — no new `AppPhase` value, no store change
- The blurred Orb behind creates context — user already sees where they're going

---

## Slide Structure — 4 slides

### Slide 1 — The Hook
- **Icon:** Microphone (gradient: coral → amber → gold)
- **Title:** "Your voice, ready to share"
- **Body:** "Record or upload audio. Ordio turns it into a polished, captioned video."
- **Visual:** Animated waveform bars in the slide gradient palette
- **Footer:** Dot 1 active · arrow circle → · "Skip intro" below

### Slide 2 — How to Start
- **Icon:** Circle/target (gradient: teal → cyan → indigo)
- **Title:** "Tap the orb to begin"
- **Body:** "Speak naturally. Or upload an MP3, WAV, or M4A — up to 50 MB."
- **Visual:** Mini Orb with gradient ring glow
- **Footer:** Dot 2 active · arrow circle →

### Slide 3 — AI Captions
- **Icon:** Speech bubble (gradient: lavender → violet → rose)
- **Title:** "Captions, automatically"
- **Body:** "AI transcribes every word and syncs captions to your audio. No editing required."
- **Visual:** Caption pill with gradient border
- **Footer:** Dot 3 active · arrow circle →

### Slide 4 — Style Reveal ★
- **Icon:** Pencil/edit (full spectrum gradient)
- **Title:** "Not just a waveform"
- **Body:** "Swap styles in the export screen — graphic frames, bars, circle, spectrogram."
- **Visual:** 4 style tiles, each with its own gradient-coloured icon
- **Footer:** Dot 4 active · checkmark circle (done, no arrow)
- **No "Skip intro"** — this is the last slide

---

## Visual Design

### Dialog card
- Width: `min(340px, calc(100vw - 32px))` — full-width on small screens, capped at 340px
- Background: `--background` token
- Border: `--onboarding-border` (add to `globals.css`: `rgba(255,255,255,0.07)`)
- Border radius: `20px`
- Padding: `24px 20px 18px`

All colours must map to tokens defined in `globals.css`. Add the following new tokens for this feature:

```css
/* globals.css — onboarding tokens */
--onboarding-border: rgba(255, 255, 255, 0.07);
--onboarding-glow-opacity: 0.28;

/* Per-slide gradient palettes (used for icon strokes, bars, dots, glows) */
--gradient-s1: linear-gradient(135deg, #ff6b6b, #ff9a3c, #ffd166);   /* coral → amber → gold */
--gradient-s2: linear-gradient(135deg, #00e5c0, #00aaff, #6e56cf);   /* teal → cyan → indigo */
--gradient-s3: linear-gradient(135deg, #b58aff, #e056a8, #ff6b6b);   /* lavender → violet → rose */
--gradient-s4: linear-gradient(135deg, #ff9a3c, #e056a8, #6e56cf);   /* full spectrum */
```

SVG `linearGradient` elements sharing these stops are defined once in a hidden `<svg>` at the top of `OnboardingDialog.tsx` and referenced by `id` in icon paths — no inline hex anywhere.

### Color language
- **Dark card stays** — the background is always near-black
- **Color lives in elements:** gradient icon strokes, waveform bars, active dot, caption pill border, tile icon strokes
- **Each slide has its own gradient palette** — Coral/Amber → Teal/Indigo → Violet/Rose → Full Spectrum
- **Ambient glow** — soft coloured bloom at top of dialog, matching the slide's icon gradient
- **Buttons stay white** — `#f0f0f0` circle arrow button, clean against dark card

### Slide visual elements

All visuals are **standalone SVG/div decorations** — they do not reuse the canvas `renderFrame()` or waveform pipeline.

| Slide | Visual | Dimensions | Animation |
|-------|--------|------------|-----------|
| 1 | 12 SVG `rect` bars in slide gradient | `height: 24px`, bars `3.5px wide` | Heights animate 0.8s ease-in-out, staggered, infinite loop |
| 2 | Concentric div rings with gradient border | Outer `54×54px`, inner `34×34px` | Subtle pulse: scale 1→1.04→1, 2s ease-in-out loop |
| 3 | Caption pill with gradient border | Full card width, `padding: 8px 12px` | Static |
| 4 | 2×2 grid of style tiles | Grid fills card width, `gap: 5px`, tiles `1:1` | Static |

### Icon treatment
- Container: `56×56px`, `border-radius: 16px`, `background: var(--background)` with subtle inner glow
- SVG strokes use `linearGradient` fills — multi-stop per slide palette (referenced by id, not inline)
- No flat colour icons

### Accessibility
- `DialogTitle` maps to the slide `d-title` text (wrapped in shadcn `<DialogTitle>`, visually styled via `cn()`)
- `DialogDescription` maps to the slide `d-body` text
- `×` button has `aria-label="Close onboarding"`
- Circle arrow/check button has `aria-label="Next"` / `aria-label="Get started"`

### Footer
- **Left:** Progress dots — inactive uses `--muted` token, active dot uses slide gradient as inline SVG background, `width: 12px, border-radius: 2px` (pill shape). Step is 0-indexed internally; dot index maps as `dotIndex === step`.
- **Right:** Circle button `32×32px`, white background, dark chevron/check icon
- Slide 1 only: "Skip intro" text link centered below footer.
- **All slides:** A small `×` icon button in the top-right corner of the dialog. Pressing it marks `ordio_onboarded` and closes. This ensures users always have an exit — the forced-flow between slides 2–3 is intentional but must never feel like a trap.
- Rationale for no "Skip" text on slides 2–4: The slide 4 style reveal is the feature users most commonly miss; the X provides an escape without advertising it as prominently as a full skip link.

### Transitions
- Framer Motion slide transition between steps — `x` axis, `AnimatePresence` with `mode="wait"`
- Duration: `0.3s`, easing: `easeInOut`
- Icon entrance: scale + fade on each slide mount

---

## Persistence

```ts
// Mark seen — called on any exit: done (slide 4) or skip (slide 1)
localStorage.setItem('ordio_onboarded', 'true')

// Check on mount — must be inside useEffect (localStorage is browser-only)
const [open, setOpen] = useState(false)
useEffect(() => {
  if (localStorage.getItem('ordio_onboarded') !== 'true') setOpen(true)
}, [])
```

`ordio_onboarded` is set on **any** intentional exit — checkmark press (slide 4) or "Skip intro" press (slide 1). The Dialog is not externally dismissible (see below), so there is no other exit path.

**SSR safety:** `localStorage` must only be read inside `useEffect`. Never read it at module scope or during render — this will throw in Next.js App Router.

---

## `useOnboarding` Hook Interface

```ts
interface UseOnboardingReturn {
  open: boolean        // whether dialog should be shown
  step: number         // 0-indexed internally (0–3); display as step + 1
  next: () => void     // advance step by 1; only valid on slides 0–2
  dismiss: () => void  // mark ordio_onboarded + close; used by ×, skip, and slide 3 done button
}
```

**Slide 4 button** calls `dismiss()` directly — not `next()`. The `next()` function is only valid for slides 0–2. This avoids an ambiguous delegation chain. The circle button on slide 3 (index) renders a checkmark and calls `dismiss()`.

---

## Component Structure

```
OnboardingDialog
├── useOnboarding()            — localStorage read/write, step state, open state
├── <Dialog>                   — shadcn Dialog, open prop controlled
│   └── <DialogContent>        — no close X button; suppress all default dismiss behaviour:
│                                  onInteractOutside={(e) => e.preventDefault()}
│                                  onEscapeKeyDown={(e) => e.preventDefault()}
│       └── <AnimatePresence>
│           └── <OnboardingSlide key={step}>
│               ├── AmbientGlow        — absolute positioned colored blur
│               ├── IconRing           — gradient SVG icon
│               ├── Title + Body
│               ├── SlideVisual        — waveform | mini orb | caption pill | style tiles
│               └── SlideFooter
│                   ├── DotProgress
│                   └── CircleButton   — next or done
```

---

## shadcn Requirements

shadcn has **not** been initialised in this project yet. This onboarding is the first use of shadcn. The implementer must run init before adding any component:

```bash
# From apps/web/
npx shadcn@latest init
# Choose: style=default, base colour=neutral, CSS variables=yes, tailwind config path=tailwind.config.ts
npx shadcn@latest add dialog
```

This creates `components.json`, `src/components/ui/`, and installs `@radix-ui/react-dialog`. This is a one-time project-wide bootstrap — future shadcn components are added with `add` only.

---

## File Locations

| File | Purpose |
|------|---------|
| `components/soul/OnboardingDialog.tsx` | Main dialog component |
| `hooks/useOnboarding.ts` | localStorage + step logic |
| `components/soul/index.ts` | Export OnboardingDialog |

Integrate in `apps/web/src/app/create/page.tsx` — render `<OnboardingDialog />` alongside the existing phase components.

---

## Out of Scope

- Analytics events on skip/complete (future)
- Re-triggerable onboarding from settings (future)
- Localisation (future)
