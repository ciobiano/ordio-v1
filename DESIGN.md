# Ordio Design System

> Extracted from the splash screen (2026-03-30). Extend via `/design-consultation`.

## Brand Identity

- **Voice:** Audio-native, restrained, purposeful. No hype. No generic SaaS aesthetics.
- **Aesthetic:** Dark canvas — black backgrounds, white type, frosted glass surfaces. Apple/OpenAI restraint.
- **References:** GitHub 2026 (weight contrast, monospace eyebrows), Apple 2019 (clear space, no decoration)

---

## Color

```
Canvas:     #000000          (bg-black)
Surface:    rgba(255,255,255,0.05)–0.10  (frosted glass, bg-white/5 to bg-white/10)
Border:     rgba(255,255,255,0.10)       (border-white/10)
Text/100:   rgba(255,255,255,1.0)        (text-white)
Text/60:    rgba(255,255,255,0.60)       (text-white/60)
Text/45:    rgba(255,255,255,0.45)       (text-white/45) — eyebrow/secondary
Text/20:    rgba(255,255,255,0.20)       (text-white/20) — tertiary/meta
Accent CTA: #ffffff                      (bg-white text-black — primary action on dark bg)
```

No purple gradients. No blue-to-purple color schemes. No decorative shadows.

---

## Typography

**Acid system (bold-consumer UI, e.g. Share Card): Nunito, one family for display + body.**
Loaded via `next/font/google` in `layout.tsx` as `--font-acid-nunito` (weights 400–900),
wired to `--acid-font-display` / `--acid-font-body` in `globals.css`. Weight carries the
display/body distinction (`font-semibold`/`font-black` for hero type, `font-medium`/`font-normal`
for body) rather than a second family.

*Why Nunito:* the brand target is "Spotify Wrapped energy, Duolingo confidence" (see
`memory/feedback_ordio_bold_consumer_aesthetic.md`). Neither Spotify Circular nor Duolingo
Feather Bold is licensable — both are bespoke, commissioned faces. Duolingo's own brand
guidelines name **Nunito** as the substitute font for anyone without access to Feather Bold,
so this is a documented register match, not a guess. Tradeoff: it's also the most-used
rounded Google Font of the last decade — reads as "friendly Google Font" before it reads as
"Ordio." Decided 2026-07-27, see `memory/project_typography_review_2026-07.md` for the full
comparison (Cabinet Grotesk, Plus Jakarta Sans, Fraunces, PP Right Grotesk were the other
candidates considered).

Retired: Clash Grotesk + Satoshi (previous Acid pairing — well-executed but became the most
commonly cloned "trendy startup" font of 2023–2025, cutting against the no-slop rule).
HelveticaNeueCyr and TrendSansOne were also removed — verified zero consumers in the codebase.

**Caption/export engine is a separate system and unaffected.** `packages/engine/src/loaders/fontLoader.ts`
loads caption fonts (Geist, Inter, Roboto, Outfit, Poppins, Montserrat, Space Grotesk, DM Sans,
Playfair Display, Lora) dynamically from Google Fonts or `/fonts/Geist-Regular.woff2` at render
time — it never touched the removed font files.

### The scale — size, leading and tracking are one triple

Every role binds all three. They are defined in `globals.css` and exposed through
Tailwind v4's `--text-{name}--line-height` / `--letter-spacing` modifiers, so a single
`text-acid-*` class applies the whole triple. **Never add a separate `leading-*` or
`tracking-*` next to one** — that decouples the pair and is what the old system did wrong.

Tracking follows the **inverse-size rule**: large type reads loose at default spacing,
small type reads cramped. Reference anchor is M3/Roboto (−0.025em at 57px display, 0 at
body, +0.05em at 12px label), then calibrated for Nunito — its rounded terminals carry more
optical whitespace than a flat-terminal grotesque, so display roles run ~0.01em tighter than
the Roboto reference; its large x-height (~0.49em) also tolerates tighter leading.

| Role | Size | Leading | Tracking | Use |
|------|------|---------|----------|-----|
| `text-acid-stat` | 48→88px | 0.95 | −0.02em | Wrapped-style numerals |
| `text-acid-display` | 40→72px | 1.0 | −0.035em | One hero line per screen |
| `text-acid-title` | 28→40px | 1.08 | −0.025em | Section openers |
| `text-acid-headline` | 22→26px | 1.25 | −0.015em | Card / group headers |
| `text-acid-body` | 15→17px | 1.55 | 0 | Reading default |
| `text-acid-label` | 13→14px | 1.4 | +0.005em | Controls, pills, buttons |
| `text-acid-caption` | 12→13px | 1.45 | +0.01em | Meta, timestamps |
| `text-acid-footnote` | 11→12px | 1.4 | +0.02em | Smallest role |
| `text-acid-eyebrow` | 13→14px | 1.2 | +0.14em | All-caps micro-label |

Two roles break the size-driven curve on purpose:
- **Eyebrow** — all-caps has no ascender/descender variation to separate glyphs, so its
  tracking is driven by *casing*, not size (general rule is 0.05–0.1em; 0.14em here is a
  deliberate brand choice, louder than default).
- **Stat** — digits are uniform-width with none of the awkward pairs that drive negative
  tracking in text, so numerals run looser than a letter role at the same size.

### Card scale — fixed-composition artifacts

The Share Card is a locked 9:16 export whose internal proportions must survive rendering at
any display size, so it uses **fixed px, not `clamp()`** — viewport-relative type would let
the composition drift. Same tracking curve, anchored to the card instead of the viewport.

| Role | Size | Leading | Tracking |
|------|------|---------|----------|
| `text-card-headline` | 34px | 1.02 | −0.025em |
| `text-card-title` | 15px | 1.2 | −0.01em |
| `text-card-meta` | 12px | 1.35 | +0.01em |

### Kerning

`font-kerning: normal` is set on `body`. Browsers disable a font's own kern pairs at small
sizes under the default `auto`; forcing `normal` applies them at every size, which is what
fixes gappy pairs (Va, To, Ay, LT). `font-variant-ligatures: common-ligatures contextual`
is set alongside it.

Deliberately **not** using `text-rendering: optimizeLegibility` — it buys the same kerning
at the cost of known layout-jank and dropped-text bugs on long documents.

### Units

- **Tracking in `em`** — stays proportional across each `clamp()` range. Never `px`.
- **Leading unitless** — nested elements inherit a *ratio*; a `px` value would lock children
  to the parent's line box.

Tailwind scale used throughout for non-Acid chrome — do not use arbitrary `text-[Npx]` values.

| Role       | Class             | Usage                          |
|------------|-------------------|--------------------------------|
| Display    | `text-3xl` / `text-4xl` | Hero headlines                 |
| Headline   | `text-2xl`        | Section headers                |
| Eyebrow    | `text-xs` + `tracking-wide` | Monospace-feel labels above headlines |
| Body       | `text-sm`         | Descriptions, labels           |
| Caption    | `text-xs`         | Meta, timestamps               |

Font weight split: `font-light` for sentence start, `font-bold` for the key noun (Ordio brand pattern).
Example: `Record your <strong>story</strong>` — light + bold within the same heading.

Tracking: headlines use `tracking-tight`. Eyebrows use `tracking-wide`.

## Mobile Apple Feel (Mobile-First)
Target a clean, Apple-app like look for iOS devices.
- Typography: System fonts first (SF Pro Display / SF Pro Text), with Apple-like crisp rendering.
- Surface: Frosted glass surfaces with slight elevation; use backdrop-filter blur where supported.
- Controls: Large tap targets, generous vertical rhythm, rounded pills for CTAs.
- Color: High-contrast white on near-black canvas; maintain small accent color usage rather than loud.
- Imagery: Minimal hero ornamentation; focus on typography and whitespace.
- Example tokens:
  - Font-family: ui-sans-serif, -apple-system, "SF Pro Display", "SF Pro Text", Roboto, Arial, sans-serif
  - Heading sizes: Display 34-40px on mobile, body 16px
  - Border radii: 14-20px for surfaces
  - CTA: white background, black text, radius 14px
- Motion: subtle, no parallax; prefer fade/slide with quick durations (200-300ms)
- Accessibility: ensure accessible contrast, large tap targets, proper focus ring

---

## Spacing

Use Tailwind 4-unit scale. Key values:
- Page inset: `px-5` (20px) on mobile, `px-6` (24px) for content blocks
- Section gap: `gap-3` to `gap-6`
- Bottom safe area: `pb-8` (32px) above home indicator

---

## Components

### Frosted Glass Surface
```
bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl
```
Use for: floating controls, sliders, modals on dark backgrounds.

### Primary CTA Button (dark bg variant)
```
bg-white text-black rounded-2xl h-14 font-bold text-sm tracking-tight
active:scale-95 transition-transform duration-100
```

### Dash Progress Indicator
```
Active:   h-0.5 w-7 rounded-full bg-white/90 (transition-all duration-300)
Inactive: h-0.5 w-5 rounded-full bg-white/20
```

### Logo Mark
```
w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center
```
Paired with `text-sm font-bold tracking-tight text-white` wordmark.

---

## Animation

- **Page transitions:** `opacity` + `y: 8px` fade-up, 300ms, `[0.22, 1, 0.36, 1]` easing
- **Carousel content:** cross-fade 150ms ease-out (Decision 3A)
- **Shimmer sweep:** 2.8s ease-in-out infinite (shimmer keyframe in globals.css)
- **Slide-to-continue snap-back:** `transition: left 300ms ease`
- **Touch feedback:** `active:scale-95 transition-transform duration-100`

Targets: hero entrance, page transitions, named interactive states. NO blanket scroll FadeIn wrappers.

---

## Visual Anchor (Splash-specific)

The upper 60% of the splash canvas contains a subtle ambient waveform visualization (Decision 1A):
- 20–40 SVG/canvas bars, white at 6–12% opacity
- Slow ambient animation (no reactivity on splash — reactive waveform lives in `/create`)
- Communicates "audio app" without copy
- Present in both carousel and returning-user states

---

## Responsive

- **Mobile-first.** Primary target: 375px–430px viewport width.
- **Desktop behavior:** Not yet specified. See Pass 6 TODO.
- Touch targets: 44px minimum (per Apple HIG). Splash CTA is `h-14` (56px) ✅. Dash buttons are `h-0.5` visually but need `min-h-[44px]` wrapper for touch.

---

## Phase 3: Page-by-Page Visual Audit (Mobile)

- Pages to audit (mobile):
- Home: /
- Create: /create
- Dashboard: /dashboard
- Settings: /settings
- Auth: /login, /signin, /auth, /sso

- For each page:
- goto <url>
- snapshot -i -a -o "$REPORT_DIR/screenshots/<page>-mobile-annotated.png"
- responsive "$REPORT_DIR/screenshots/<page>-mobile.png"
- console --errors
- perf

---

## Accessibility

- `aria-live="polite"` on carousel text container ✅
- Dash indicators use `<button>` with `aria-label` and `aria-current` ✅
- Spinner/loading: overlay via `NavigationTransition`
- Color contrast: white text on black bg exceeds WCAG AA ✅
- Touch events: `touch-none select-none` on drag targets ✅
