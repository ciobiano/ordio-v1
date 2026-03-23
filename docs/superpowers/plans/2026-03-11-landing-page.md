# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved HTML mockup into a production Next.js landing page at `/`, moving the existing audiogram tool to `/create`.

**Architecture:** Server Components for all static sections; one `'use client'` component for the FAQ accordion. Styling via Tailwind v4 utilities with arbitrary values (`before:left-[calc((100%-1000px)/2)]`) — no CSS modules. Column grid system expressed as a shared `ContentColumns` wrapper component.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Plus Jakarta Sans (already loaded), Clerk (auth links only)

**Source of truth:** `.superpowers/brainstorm/73255-1773262558/landing-hero.html`

---

## Chunk 1: Routing Restructure

Move the existing audiogram app off `/` to make room for the landing page.

### Task 1: Move audiogram tool to `/create`

**Files:**
- Create: `apps/web/src/app/create/page.tsx` (copy of current `app/page.tsx`)
- Modify: `apps/web/src/app/page.tsx` (replace with landing page stub)

- [ ] **Step 1: Create `/create` route**

Copy the existing `app/page.tsx` content exactly as-is into `app/create/page.tsx`. No changes to the component itself.

```bash
cp apps/web/src/app/page.tsx apps/web/src/app/create/page.tsx
```

- [ ] **Step 2: Update AuthGate redirect in the moved page**

The `AuthGate` component in the audiogram tool currently redirects to sign-in. Verify it redirects back to `/create` after sign-in (not `/`). Check `components/soul/AuthGate.tsx` — if it uses a hardcoded redirect URL, update it to `/create`.

- [ ] **Step 3: Stub `app/page.tsx` as the landing page**

Replace `apps/web/src/app/page.tsx` with a minimal stub so the route resolves while we build the landing components:

```tsx
// apps/web/src/app/page.tsx
import { LandingPage } from '@/components/landing/LandingPage'

export default function Home() {
  return <LandingPage />
}
```

- [ ] **Step 4: Create the landing components directory**

```bash
mkdir -p apps/web/src/components/landing
```

- [ ] **Step 5: Create minimal `LandingPage` stub so the build passes**

```tsx
// apps/web/src/components/landing/LandingPage.tsx
export function LandingPage() {
  return <div className="min-h-screen bg-black text-white">Landing page — in progress</div>
}
```

- [ ] **Step 6: Verify both routes build**

```bash
pnpm --filter=web build
```

Expected: Build succeeds. `/` shows stub. `/create` shows the audiogram tool.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/create/page.tsx apps/web/src/app/page.tsx apps/web/src/components/landing/LandingPage.tsx
git commit -m "feat(routing): move audiogram tool to /create, stub landing page at /"
```

---

## Chunk 2: Global Styles for Landing

Add the waveform pulse animation and any landing-specific tokens to `globals.css`.

### Task 2: Add waveform animation keyframe

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add `wave-pulse` keyframe and Tailwind animation token**

Append to `apps/web/src/app/globals.css`:

```css
/* ─── Landing page: hero waveform animation ─── */
@keyframes wave-pulse {
  0%   { transform: scaleY(0.3); opacity: 0.5; }
  100% { transform: scaleY(1);   opacity: 1; }
}

@theme inline {
  --animate-wave-pulse: wave-pulse 1.4s ease-in-out infinite alternate;
}
```

This makes `animate-wave-pulse` available as a Tailwind class.

- [ ] **Step 2: Verify the class compiles**

```bash
pnpm --filter=web build
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(styles): add wave-pulse animation for landing hero waveform"
```

---

## Chunk 3: Landing Components

Build each section as a separate Server Component, then wire them together in `LandingPage`.

### Task 3: `ContentColumns` layout wrapper

This is the shared structural wrapper that provides the two full-height vertical column lines running through all sections.

**Files:**
- Create: `apps/web/src/components/landing/ContentColumns.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/ContentColumns.tsx
export function ContentColumns({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        'relative',
        // Left vertical rule at outer column edge
        "before:content-[''] before:absolute before:top-0 before:bottom-0",
        'before:left-[calc((100%-1000px)/2)] before:w-px before:bg-white/10 before:pointer-events-none before:z-[2]',
        // Right vertical rule
        "after:content-[''] after:absolute after:top-0 after:bottom-0",
        'after:right-[calc((100%-1000px)/2)] after:w-px after:bg-white/10 after:pointer-events-none after:z-[2]',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write a smoke test**

```tsx
// apps/web/src/__tests__/landing/ContentColumns.test.tsx
import { render } from '@testing-library/react'
import { ContentColumns } from '@/components/landing/ContentColumns'

test('renders children', () => {
  const { getByText } = render(<ContentColumns><p>hello</p></ContentColumns>)
  expect(getByText('hello')).toBeTruthy()
})
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter=web vitest run src/__tests__/landing/ContentColumns.test.tsx
```

Expected: PASS

---

### Task 4: `LandingNav`

**Files:**
- Create: `apps/web/src/components/landing/LandingNav.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingNav.tsx
import Link from 'next/link'

export function LandingNav() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-12 py-5">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 font-bold text-[18px] tracking-[-0.3px]">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect width="28" height="28" rx="7" fill="#6366f1"/>
          <rect x="5"  y="13" width="3" height="10" rx="1.5" fill="white"/>
          <rect x="10" y="9"  width="3" height="14" rx="1.5" fill="white"/>
          <rect x="15" y="6"  width="3" height="17" rx="1.5" fill="white"/>
          <rect x="20" y="10" width="3" height="13" rx="1.5" fill="white"/>
        </svg>
        Ordio
      </Link>

      {/* Centre links */}
      <div className="flex gap-8 text-sm text-white/60">
        <span className="cursor-pointer hover:text-white transition-colors">Product</span>
        <span className="cursor-pointer hover:text-white transition-colors">Pricing</span>
        <span className="cursor-pointer hover:text-white transition-colors">Blog</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/create"
          className="border border-white/15 text-white/80 px-[18px] py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
        >
          Log In
        </Link>
        <Link
          href="/create"
          className="bg-white text-black font-semibold px-[18px] py-2 rounded-lg text-sm hover:bg-white/90 transition-colors"
        >
          Get Started Free
        </Link>
      </div>
    </nav>
  )
}
```

---

### Task 5: `LandingHero`

The hero section: 5-column grid, app preview card with animated waveform, floating feature tags, headline, CTAs.

**Files:**
- Create: `apps/web/src/components/landing/LandingHero.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingHero.tsx
import Link from 'next/link'

const BARS = [14,22,32,26,38,28,40,34,24,30,36,20,16,26,22,18,28,35,38,29,24,19,14,21]

const TAGS = [
  { label: 'AI Transcription', color: 'bg-[#22c55e] text-black', style: { top: '-10px', left: '36px',  transform: 'rotate(-4deg)' } },
  { label: 'Wave Styles',      color: 'bg-[#3b82f6] text-white', style: { top: '-10px', left: '50%',   transform: 'translateX(-50%) rotate(2deg)' } },
  { label: 'MP4 Export',       color: 'bg-[#a855f7] text-white', style: { top: '-10px', right: '36px', transform: 'rotate(4deg)' } },
  { label: 'No Server',        color: 'bg-[#06b6d4] text-black', style: { top: '50%',   left: '4px',   transform: 'translateY(-50%) rotate(-6deg)' } },
  { label: 'Caption Editor',   color: 'bg-[#f97316] text-white', style: { bottom: '-10px', left: '44px',  transform: 'rotate(3deg)' } },
  { label: 'Custom Fonts',     color: 'bg-[#ec4899] text-white', style: { bottom: '-10px', right: '44px', transform: 'rotate(-3deg)' } },
]

export function LandingHero() {
  return (
    <div className={[
      // 5-column grid: gutter | 180px | 640px | 180px | gutter
      'relative z-[1] grid mt-[60px]',
      '[grid-template-columns:1fr_180px_640px_180px_1fr]',
      // Bounded horizontal borders top/bottom
      "before:content-[''] before:absolute before:top-0 before:left-[calc((100%-1000px)/2)] before:right-[calc((100%-1000px)/2)] before:h-px before:bg-white/[0.12] before:z-[2]",
      "after:content-[''] after:absolute after:bottom-0 after:left-[calc((100%-1000px)/2)] after:right-[calc((100%-1000px)/2)] after:h-px after:bg-white/[0.12] after:z-[2]",
    ].join(' ')}>

      {/* Inner column dividers (framing the card) */}
      <div className="absolute top-0 bottom-0 w-px bg-white/[0.08] pointer-events-none left-[calc((100%-740px)/2)]" />
      <div className="absolute top-0 bottom-0 w-px bg-white/[0.08] pointer-events-none right-[calc((100%-740px)/2)]" />

      {/* Crosshairs at 4 corners of the 1000px column */}
      {[
        { style: { top: '-7px',  left:  'calc((100% - 1000px) / 2 - 9px)' } },
        { style: { top: '-7px',  right: 'calc((100% - 1000px) / 2 - 9px)' } },
        { style: { bottom: '-7px', left:  'calc((100% - 1000px) / 2 - 9px)' } },
        { style: { bottom: '-7px', right: 'calc((100% - 1000px) / 2 - 9px)' } },
      ].map((c, i) => <Crosshair key={i} style={c.style} />)}

      {/* Hero content — spans all columns */}
      <div className="relative z-[1] col-span-full flex flex-col items-center gap-10 px-6 pt-[120px]">

        {/* App preview */}
        <div className="relative inline-block px-[52px] py-7 mb-[52px]">
          {/* Feature tags */}
          {TAGS.map((t) => (
            <span
              key={t.label}
              className={`absolute px-[13px] py-[5px] rounded-full text-xs font-semibold whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.4)] z-[5] ${t.color}`}
              style={t.style}
            >
              {t.label}
            </span>
          ))}

          {/* App card */}
          <div className="bg-[#111] border border-white/[0.12] rounded-2xl overflow-hidden px-7 pt-3.5 pb-[18px] w-[620px] shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Traffic lights */}
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.08]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
              <span className="ml-2 text-[13px] text-white/40">ordio.app — export preview</span>
            </div>

            {/* Caption */}
            <div className="text-center text-xs font-normal tracking-[0.01em] text-white/75 bg-white/[0.05] rounded-md px-3 py-1.5 mb-2.5">
              "and that's the <span className="text-[#a5b4fc]">power of consistency</span> over time"
            </div>

            {/* Waveform */}
            <div className="flex items-center justify-center h-11 gap-[3px] mb-2.5">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className={[
                    'w-1.5 rounded-full bg-gradient-to-t from-[#6366f1] to-[#a5b4fc]',
                    'animate-wave-pulse',
                    i % 2 !== 0 ? '[animation-delay:-0.3s]' : '',
                    i % 3 === 0 ? '[animation-delay:-0.7s]' : '',
                  ].join(' ')}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 px-6 py-3 bg-white/[0.04] rounded-full border border-white/[0.08] w-fit mx-auto">
              {['⏮','▶','⏭'].map((icon, i) => (
                <button key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i === 1 ? 'bg-white text-black' : 'text-white/70'}`}>{icon}</button>
              ))}
              <div className="w-px h-5 bg-white/[0.12]" />
              {['🎵','Aa','⬛'].map((icon, i) => (
                <button key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white/70">{icon}</button>
              ))}
              <div className="w-px h-5 bg-white/[0.12]" />
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white/70">⬇</button>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center max-w-[640px] mb-9">
          <h1 className="text-[52px] font-normal tracking-[-1.5px] leading-[1.1] mb-5">
            Your voice,<br />beautifully visualised.
          </h1>
          <p className="text-[17px] text-white/50 leading-relaxed">
            Record or upload audio. Get <strong className="text-white/85 font-semibold">AI transcription</strong>. Export a stunning audiogram video —<br />
            all in the browser, no account required.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex gap-3 justify-center mb-20">
          <Link href="/create" className="bg-white text-black font-bold text-[15px] px-7 py-3.5 rounded-full flex items-center gap-2 hover:bg-white/90 transition-colors">
            ▶&nbsp; Create Audiogram Free
          </Link>
          <button className="text-white/80 text-[15px] font-medium px-7 py-3.5 rounded-full border border-white/20 hover:bg-white/5 transition-colors">
            See how it works
          </button>
        </div>
      </div>
    </div>
  )
}

function Crosshair({ style }: { style: React.CSSProperties }) {
  return (
    <div className="absolute w-5 h-5 pointer-events-none z-[5]" style={style}>
      <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-white/80 -translate-x-1/2" />
      <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-white/80 -translate-y-1/2" />
    </div>
  )
}
```

---

### Task 6: `LandingFeatures`

**Files:**
- Create: `apps/web/src/components/landing/LandingFeatures.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingFeatures.tsx
const STEPS = [
  {
    copy: <><strong className="text-white/90 font-normal">Record or upload.</strong> Capture directly in the browser or drop in any MP3, WAV, or M4A file. No app to install.</>,
    icon: 'group', // mic + upload stacked capsule
  },
  {
    copy: <><strong className="text-white/90 font-normal">Instant AI transcription.</strong> Whisper-powered word-level captions appear automatically. Edit any word with a click.</>,
    icon: 'round-purple',
  },
  {
    copy: <><strong className="text-white/90 font-normal">Style it your way.</strong> Pick a waveform, font, colour, and aspect ratio. Preview updates live — what you see is what exports.</>,
    icon: 'round-cyan',
  },
  {
    copy: <><strong className="text-white/90 font-normal">Export and share.</strong> Download a crisp MP4 ready for Twitter, LinkedIn, Instagram, or TikTok.</>,
    icon: 'round-white',
  },
]

export function LandingFeatures() {
  return (
    <section className={[
      'relative z-[1] grid gap-12 px-[120px] pt-[72px] pb-20',
      '[grid-template-columns:280px_1fr]',
      // Bottom border aligned to outer column lines
      "after:content-[''] after:absolute after:bottom-0 after:[left:calc(50%-500px)] after:[right:calc(50%-500px)] after:h-px after:bg-white/10",
    ].join(' ')} style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Left: section heading */}
      <div>
        <h2 className="text-[32px] font-normal tracking-[-0.5px] leading-[1.2] mt-[72px] text-white/90">
          Record once.<br />Publish everywhere.
        </h2>
      </div>

      {/* Right: vertical timeline */}
      <div className="relative flex flex-col self-stretch pt-[72px] pb-20 -mb-20 gap-[50px]">
        {/* Timeline background line */}
        <div className="absolute left-[15px] top-[-70px] bottom-0 w-px bg-white/10 z-0" />
        {/* Progress bar */}
        <div className="absolute left-[14px] top-[72px] w-[2px] bg-gradient-to-b from-[#EA5753] to-[#FFB88E] rounded-[1px] z-[1]" style={{ height: '70%' }} />

        {STEPS.map((step, i) => (
          <div key={i} className="flex gap-6 items-start pb-24 last:pb-0 relative z-[2]">
            <TimelineIcon type={step.icon} />
            <p className="text-xl text-white/60 leading-[1.7] m-0">{step.copy}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TimelineIcon({ type }: { type: string }) {
  const base = 'flex-shrink-0 w-[30px] flex flex-col items-center'

  if (type === 'group') {
    return (
      <div className={base}>
        <div className="w-[30px] border border-white/[0.14] rounded-[20px] bg-[#0a0a0a] overflow-hidden flex flex-col">
          {/* Mic */}
          <div className="w-[30px] h-10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </div>
          {/* Upload */}
          <div className="w-[30px] h-10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
        </div>
      </div>
    )
  }

  const strokeColors: Record<string, string> = {
    'round-purple': 'rgba(168,85,247,0.9)',
    'round-cyan':   'rgba(6,182,212,0.9)',
    'round-white':  'rgba(255,255,255,0.7)',
  }
  const stroke = strokeColors[type] ?? 'white'

  const icons: Record<string, React.ReactNode> = {
    'round-purple': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    'round-cyan':   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="17" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/></svg>,
    'round-white':  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  }

  return (
    <div className={base}>
      <div className="w-[38px] h-[38px] rounded-full bg-[#0a0a0a] border border-white/[0.22] flex items-center justify-center flex-shrink-0">
        {icons[type]}
      </div>
    </div>
  )
}
```

---

### Task 7: `FAQAccordion` (client component)

**Files:**
- Create: `apps/web/src/components/landing/FAQAccordion.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/__tests__/landing/FAQAccordion.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { FAQAccordion } from '@/components/landing/FAQAccordion'

const items = [
  { q: 'Is it free?', a: 'Yes, it is free.' },
  { q: 'What formats?', a: 'MP3, WAV, M4A.' },
]

test('first item open by default', () => {
  const { getByText } = render(<FAQAccordion items={items} />)
  expect(getByText('Yes, it is free.')).toBeVisible()
})

test('clicking closed item opens it and closes the previous', () => {
  const { getByText } = render(<FAQAccordion items={items} />)
  fireEvent.click(getByText('What formats?'))
  expect(getByText('MP3, WAV, M4A.')).toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter=web vitest run src/__tests__/landing/FAQAccordion.test.tsx
```

Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `FAQAccordion`**

```tsx
// apps/web/src/components/landing/FAQAccordion.tsx
'use client'

import { useState } from 'react'

export interface FAQItem { q: string; a: string }

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState(0)

  return (
    <div className="relative flex flex-col border-t border-white/[0.12] pl-10">
      {/* Vertical divider line — spans full section height via negative margin trick */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 pointer-events-none" />

      {items.map((item, i) => (
        <div
          key={i}
          className={[
            'border-b border-white/[0.12] -mx-2.5 rounded-md cursor-pointer select-none transition-colors duration-150',
            open === i ? 'bg-white/[0.03]' : 'hover:bg-white/[0.025]',
          ].join(' ')}
          onClick={() => setOpen(i === open ? -1 : i)}
        >
          <div className="flex justify-between items-center gap-4 py-5 px-0">
            <span className={`text-[15px] leading-[1.5] transition-colors duration-150 ${open === i ? 'text-white/90' : 'text-white/60'}`}>
              {item.q}
            </span>
            <svg
              className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-[220ms] ease-out ${open === i ? 'rotate-180 text-white/60' : 'text-white/25'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div
            className={`overflow-hidden text-sm text-white/45 leading-[1.8] transition-all duration-300 ease-out ${open === i ? 'max-h-40 pb-5' : 'max-h-0 pb-0'}`}
          >
            {item.a}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter=web vitest run src/__tests__/landing/FAQAccordion.test.tsx
```

Expected: PASS

---

### Task 8: `LandingFAQ` wrapper

**Files:**
- Create: `apps/web/src/components/landing/LandingFAQ.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingFAQ.tsx
import { FAQAccordion, FAQItem } from './FAQAccordion'

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'Is Ordio free to use?',
    a: 'Yes. The core tool is completely free — no account required. Create audiograms, add AI captions, and export MP4 videos at no cost. Pro plans unlock extra styles, watermark removal, and HD audio enhancement.',
  },
  {
    q: 'What audio formats does Ordio support?',
    a: 'MP3, WAV, M4A, and OGG. You can also record directly in the browser — no file upload needed.',
  },
  {
    q: 'How accurate is the AI transcription?',
    a: 'Ordio uses OpenAI Whisper for word-level transcription. Accuracy is typically 95%+ for clear English audio. Every word is editable inline before you export.',
  },
  {
    q: 'Does Ordio store my audio or video?',
    a: 'No. All rendering happens in your browser. Audio sent for transcription is processed and immediately discarded — nothing is stored on our servers.',
  },
  {
    q: 'What aspect ratios and resolutions are supported?',
    a: '16:9 landscape (YouTube, LinkedIn), 9:16 vertical (Reels, Shorts, TikTok), and 1:1 square (Twitter, Instagram). All formats export at 1080p.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No account is needed to use the free tier. Sign up only if you want to save projects, access Pro styles, or remove the Ordio watermark.',
  },
]

export function LandingFAQ() {
  return (
    <section
      className="relative z-[1] grid gap-[60px] px-[120px] pt-20 pb-24 [grid-template-columns:280px_1fr]"
      style={{ maxWidth: '1200px', margin: '0 auto' }}
    >
      <h2 className="text-[32px] font-normal tracking-[-0.5px] leading-[1.2] pt-1.5 text-white/90">
        Frequently<br />asked<br />questions.
      </h2>
      <FAQAccordion items={FAQ_ITEMS} />
    </section>
  )
}
```

---

### Task 9: `LandingCTABanner`

**Files:**
- Create: `apps/web/src/components/landing/LandingCTABanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingCTABanner.tsx
import Link from 'next/link'

export function LandingCTABanner() {
  return (
    <div className="relative z-[1] flex justify-center px-0 pt-[60px]">
      <div className="relative w-[1000px] grid border border-white/[0.12] [grid-template-columns:1fr_380px]">
        {/* Crosshairs */}
        <Crosshair className="top-[-10px] left-[-10px]" />
        <Crosshair className="bottom-[-10px] right-[-10px]" />

        {/* Left */}
        <div className="px-14 py-[52px] border-r-2 border-dashed border-white/[0.12]">
          <p className="text-xl font-normal text-white/55 leading-[1.55] mb-6">
            Not sure which plan fits? Try{' '}
            <span className="text-[#6366f1]">Creator</span> or{' '}
            <span className="text-[#a855f7]">Pro</span> free for 14 days —{' '}
            <strong className="text-white/90 font-normal">no credit card required.</strong>
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-[22px] py-2.5 rounded-full border border-white/[0.18] text-white/75 text-sm hover:border-white/[0.38] hover:text-white hover:bg-white/[0.04] transition-all duration-150"
          >
            Start free trial &nbsp;→
          </Link>
        </div>

        {/* Right */}
        <div className="px-11 py-[52px]">
          <p className="text-base text-white/50 leading-[1.6] mb-7">
            <strong className="text-white/90 font-semibold">Creators export in under 3 minutes.</strong>{' '}
            From recording to ready-to-post MP4 — no video editor needed.
          </p>
          <button className="inline-flex items-center gap-2 px-[22px] py-2.5 rounded-full border border-white/[0.18] text-white/75 text-sm hover:border-white/[0.38] hover:text-white hover:bg-white/[0.04] transition-all duration-150">
            See how it works
          </button>
        </div>
      </div>
    </div>
  )
}

function Crosshair({ className }: { className: string }) {
  return (
    <div className={`absolute w-5 h-5 pointer-events-none z-[5] ${className}`}>
      <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-white/70 -translate-x-1/2" />
      <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-white/70 -translate-y-1/2" />
    </div>
  )
}
```

---

### Task 10: `LandingFooter`

**Files:**
- Create: `apps/web/src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/landing/LandingFooter.tsx
const FOOTER_COLS = [
  { head: 'Get Started', links: ['Open App', 'Pricing', 'Templates', 'Changelog'] },
  { head: 'Product',     links: ['Audiograms', 'AI Captions', 'Waveform Styles', 'MP4 Export', 'Audio Enhancement'] },
  { head: 'Resources',   links: ['Blog', 'Documentation', 'API Reference', 'Status'] },
  { head: 'Company',     links: ['About', 'Careers', 'Press', 'Contact'] },
  { head: 'Legal',       links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] },
]

export function LandingFooter() {
  return (
    <footer className="mt-10">
      <div className="max-w-[1200px] mx-auto px-3 pt-20 pb-12">
        {/* Link grid */}
        <div className="grid [grid-template-columns:repeat(5,1fr)] gap-8 mb-14">
          {FOOTER_COLS.map((col) => (
            <div key={col.head}>
              <p className="text-xs font-semibold tracking-[0.09em] text-white/80 uppercase mb-3.5">{col.head}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link} className="text-[13px] text-white/45 cursor-pointer hover:text-white/85 transition-colors duration-150">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="#6366f1"/>
              <rect x="5" y="13" width="3" height="10" rx="1.5" fill="white"/>
              <rect x="10" y="9" width="3" height="14" rx="1.5" fill="white"/>
              <rect x="15" y="6" width="3" height="17" rx="1.5" fill="white"/>
              <rect x="20" y="10" width="3" height="13" rx="1.5" fill="white"/>
            </svg>
            Ordio by kaine studio
          </div>
          <span className="text-xs text-white/25">© 2025 Ordio. All rights reserved.</span>
          <div className="flex gap-5">
            {['Twitter / X', 'YouTube', 'GitHub'].map((s) => (
              <span key={s} className="text-[13px] text-white/35 cursor-pointer hover:text-white/80 transition-colors duration-150">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
```

---

### Task 11: Assemble `LandingPage`

**Files:**
- Modify: `apps/web/src/components/landing/LandingPage.tsx`

- [ ] **Step 1: Replace stub with full layout**

```tsx
// apps/web/src/components/landing/LandingPage.tsx
import { ContentColumns }  from './ContentColumns'
import { LandingNav }      from './LandingNav'
import { LandingHero }     from './LandingHero'
import { LandingFeatures } from './LandingFeatures'
import { LandingFAQ }      from './LandingFAQ'
import { LandingCTABanner }from './LandingCTABanner'
import { LandingFooter }   from './LandingFooter'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: 'var(--font-jakarta), -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <LandingNav />
      <ContentColumns>
        <LandingHero />
        <LandingFeatures />
        <LandingFAQ />
        <LandingCTABanner />
      </ContentColumns>
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 2: Run full build**

```bash
pnpm --filter=web build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 3: Run all tests**

```bash
pnpm --filter=web test
```

Expected: All existing tests pass + new landing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/ apps/web/src/app/globals.css
git commit -m "feat(landing): implement full landing page from HTML mockup"
```

---

## Chunk 4: Visual QA & Final Commit

### Task 12: Visual QA checklist

Start dev server and verify visually against the HTML mockup.

```bash
pnpm --filter=web dev
```

Open `http://localhost:3000` and check:

- [ ] Column grid lines are visible (two vertical lines framing the 1000px content)
- [ ] Hero crosshairs appear at the 4 column grid corners
- [ ] Waveform bars animate (scaleY pulse)
- [ ] Feature tags are positioned around the app card
- [ ] Timeline progress bar gradient is visible
- [ ] FAQ accordion opens/closes one item at a time with chevron rotation
- [ ] CTA banner crosshairs appear at TL and BR corners
- [ ] `/create` route still loads the audiogram tool
- [ ] Nav "Get Started Free" and hero CTAs link to `/create`

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(landing): visual QA pass — landing page complete"
```
