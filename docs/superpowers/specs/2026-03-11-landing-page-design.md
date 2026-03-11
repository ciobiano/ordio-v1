# Ordio Landing Page — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/73255-1773262558/landing-hero.html`

---

## Overview

A single-page marketing site for Ordio — a browser-based audiogram generator. The design is dark, minimalist, and product-led. Visual language is inspired by developer-focused SaaS landing pages (Vercel-style): a strict column grid, fine ruled lines as structure, crosshair markers at intersections, and motion limited to subtle waveform animation.

---

## Visual System

### Palette
- **Background:** `#000` (pure black)
- **Surface:** `#111` (app card), `#0a0a0a` (timeline icons)
- **Primary text:** `rgba(255,255,255,0.9)`
- **Secondary text:** `rgba(255,255,255,0.45–0.6)`
- **Borders / rules:** `rgba(255,255,255,0.08–0.12)`
- **Accent — indigo:** `#6366f1` / `#a5b4fc` (logo, waveform gradient, accent text)
- **Accent — purple:** `#a855f7`
- **Timeline progress:** gradient `#EA5753 → #FFB88E`
- **Feature tags:** green `#22c55e`, blue `#3b82f6`, purple `#a855f7`, cyan `#06b6d4`, orange `#f97316`, pink `#ec4899`

### Typography
- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif`
- **Hero headline:** 52px / weight 400 / letter-spacing −1.5px / line-height 1.1
- **Section headings (feature, FAQ):** 32px / weight 400 / letter-spacing −0.5px
- **Body / subline:** 17px (hero), 15px (sections) / `rgba(255,255,255,0.5)`
- **Feature timeline copy:** 20px / `rgba(255,255,255,0.6)` with `strong` at 0.9
- **FAQ question text:** 15px / `rgba(255,255,255,0.6)`
- **Footer column heads:** 12px / weight 600 / uppercase / letter-spacing 0.09em
- **Footer links:** 13px / `rgba(255,255,255,0.45)`

### Column Grid
The page uses a `1000px` content column centred in the viewport. Two full-height vertical lines (`.content-columns::before/::after`) are placed at `calc((100% - 1000px) / 2)` from each edge, running top-to-bottom through all sections. Bounded horizontal rules use the same math: `left: calc(50% - 500px)`.

Inner column dividers for the hero card sit at `calc((100% - 740px) / 2)` (softer, `opacity 0.08`).

Crosshair markers (`::before` vertical + `::after` horizontal half-pixel lines) sit at grid intersections throughout.

---

## Sections

### 1. Navigation

**Layout:** full-width flex, space-between, `padding: 20px 48px`.

**Left:** Logo — indigo `#6366f1` rounded-rect SVG icon (4 waveform bars), wordmark "Ordio" weight 700.

**Centre:** Three ghost links — Product, Pricing, Blog — `rgba(255,255,255,0.6)`, hover to full white.

**Right:** Two buttons — ghost "Log In" (border `rgba(255,255,255,0.15)`) and solid white "Get Started Free" (weight 600, black text). Both `border-radius: 8px`, `padding: 8px 18px`.

---

### 2. Hero

**Structure:** 5-column CSS grid (`1fr 180px 640px 180px 1fr`) — gutters frame the inner 640px card zone. Two bounded horizontal rules (top and bottom), four crosshairs at corners.

**Order:** App preview card above headline (inverted — product-first).

**App preview card** (`620px × auto`, `border-radius: 16px`, dark `#111`):
- macOS-style traffic-light dots header
- Caption strip: current word in indigo, surrounding text in `rgba(255,255,255,0.75)`
- Animated waveform: 24 bars, indigo gradient `#6366f1 → #a5b4fc`, `scaleY` pulse animation alternating at 1.4s
- Playback/style controls bar: pill shape, icons for seek, play, style, export

**Floating feature tags** — 6 coloured pill badges (rotate ±3–6°) positioned around the card edges: AI Transcription, Wave Styles, MP4 Export, Caption Editor, Custom Fonts, No Server.

**Headline block** (`max-width: 640px`, centred):
- H1: "Your voice, beautifully visualised." — 52px, weight 400
- Subline: 17px, muted — emphasises "AI transcription" in white

**CTA row:**
- Primary: solid white pill "▶ Create Audiogram Free" (weight 700, 14px padding)
- Secondary: ghost pill "See how it works" (border `rgba(255,255,255,0.2)`)

---

### 3. Feature Walkthrough

**Layout:** 2-column CSS grid (`280px 1fr`), `gap: 48px`, `padding: 72px 120px 80px`. Bottom border aligned to outer column lines using `calc(50% - 500px)`.

**Left column:** Sticky heading — "Record once. Publish everywhere." 32px weight 400.

**Right column — vertical timeline:**
- A `1px` vertical line (`rgba(255,255,255,0.1)`) runs from above the first item through all four.
- A `2px` gradient progress bar (`#EA5753 → #FFB88E`) overlays it at 70% height.
- 4 feature items, each: icon node + paragraph text (20px, muted).

**Timeline icon types:**
1. Grouped capsule (2 stacked icons — mic + upload)
2. Round icon — AI/chat bubble (purple)
3. Round icon — style/nodes (cyan)
4. Round icon — download arrow (white)

---

### 4. FAQ

**Layout:** 2-column grid (`280px 1fr`), `gap: 60px`, `padding: 80px 120px 96px`.

**Left column:** heading — "Frequently asked questions." 32px, weight 400.

**Right column — accordion:**
- Border-top on accordion container; border-bottom on each item (no doubling)
- 6 questions: free tier, audio formats, transcription accuracy, data privacy, aspect ratios, account requirement
- Each item: `faq-question` flex row with chevron SVG (rotates 180° on open)
- Answer: `max-height: 0 → 160px` CSS transition (smooth slide), `padding-bottom` animated alongside
- Hover: subtle background `rgba(255,255,255,0.025)`; open: `rgba(255,255,255,0.03)`
- Only one item open at a time (JS accordion toggle)

**Vertical divider line:** `1px rgba(255,255,255,0.1)` absolute, positioned at `left: 463px` (padding 120 + left col 280 + gap 60 + accordion padding-left 40 = left edge of text). Spans full section height.

---

### 5. CTA Banner

**Layout:** centred block, `width: 1000px` (aligns with outer column lines), 2-column grid (`1fr 380px`).

**Border treatment:** full outer border `rgba(255,255,255,0.12)` + dashed inner divider between columns.

**Crosshairs:** top-left and bottom-right corners only.

**Left column** (`padding: 52px 56px`):
- Heading: muted copy with indigo + purple accented plan names, white "no credit card required"
- Ghost pill CTA: "Start free trial →"

**Right column** (`padding: 52px 44px`):
- Stat: "Creators export in under 3 minutes." (bold) + brief description
- Ghost pill CTA: "📄 See how it works"

---

### 6. Footer

**Layout:** `max-width: 1200px`, `padding: 80px 12px 48px`. 5-column link grid, horizontal rule, then bottom bar.

**Link columns:** Get Started · Product · Resources · Company · Legal
- Column heads: 12px, uppercase, weight 600, `rgba(255,255,255,0.8)`
- Links: 13px, `rgba(255,255,255,0.45)`, hover to 0.85

**Bottom bar:** logo left · copyright centre · social links right (Twitter/X, YouTube, GitHub)

---

## Interactions

| Element | Behaviour |
|---|---|
| FAQ accordion | JS toggle: one item open at a time; `max-height` CSS transition |
| Waveform bars | CSS `scaleY` pulse animation, alternating delays |
| Nav links | Colour transition on hover |
| Footer links | Colour transition on hover |
| CTA banner buttons | Border + background transition on hover |
| Feature tags | Static; rotation is decorative only |

---

## Implementation Notes

- This is a static marketing page (`app/page-landing.tsx` or separate route `/` replacing the current app entry).
- The animated waveform in the hero is decorative CSS — not connected to real audio.
- The FAQ accordion JS (`querySelectorAll + classList toggle`) is ~10 lines; keep it inline or in a small utility.
- All layout uses CSS Grid and absolute positioning — no JS for layout.
- The column grid system (`content-columns`, `hero-grid`, `feature-section`, `faq-section`) should be implemented as reusable layout components or CSS custom properties.
- Font: Inter should be loaded via `next/font/google` for Next.js; the body fallback stack is already correct.
- The logo SVG (4 waveform bars in indigo rounded rect) is the canonical Ordio mark — use this as `<Image>` or inline SVG consistently.

---

## Out of Scope

- Mobile / responsive layout (desktop-first MVP)
- Pricing page
- Blog / content pages
- Animation on scroll (intersection observer)
- Real waveform driven by audio
