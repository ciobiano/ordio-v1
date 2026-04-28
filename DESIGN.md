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

Tailwind scale used throughout — do not use arbitrary `text-[Npx]` values.

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
- Fonts: Use two fonts from Designer Pack: Poppins for headings and HelveticaNeueCyr for body. Copy the actual font files to assets/fonts and register with @font-face. Then update typography tokens:
- Heading font-family: 'Poppins', ui-sans-serif, system-ui
- Body font-family: 'HelveticaNeueCyr', ui-sans-serif, system-ui
- Ensure font files are loaded locally and included in the build.
- If you can't provide the actual font files yet, wire the CSS tokens now and drop the real font files later.
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
