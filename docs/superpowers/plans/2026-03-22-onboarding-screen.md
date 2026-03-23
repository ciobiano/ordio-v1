# Onboarding Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-slide onboarding dialog that shows once to new users on `/create`, teaches them what Ordio does and that graphic styles exist.

**Architecture:** A controlled shadcn `Dialog` (never auto-dismissible) driven by a `useOnboarding` hook that owns localStorage persistence and step state. The dialog overlays the idle screen — no new AppPhase, no store changes. All visual elements are standalone SVG/div decorations; nothing reuses the waveform pipeline.

**Tech Stack:** shadcn/ui Dialog (Radix UI), Framer Motion AnimatePresence, Vitest + @testing-library/react (existing test setup)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/app/globals.css` | Add tokens, `@theme` entries, CSS utility classes, `@keyframes` |
| Bootstrap (CLI) | `apps/web/components.json` | shadcn project config (created by init) |
| Bootstrap (CLI) | `apps/web/src/components/ui/dialog.tsx` | shadcn Dialog primitive |
| Create | `apps/web/src/hooks/useOnboarding.ts` | localStorage read/write + step state |
| Create | `apps/web/src/__tests__/useOnboarding.test.ts` | Unit tests for the hook |
| Create | `apps/web/src/components/soul/OnboardingDialog.tsx` | Full dialog component (all slides) |
| Modify | `apps/web/src/components/soul/index.ts` | Export OnboardingDialog |
| Modify | `apps/web/src/app/create/page.tsx` | Render `<OnboardingDialog />` in CreateContent |

---

## Task 1: Add tokens, Tailwind theme entries, and CSS utility classes to globals.css

All dynamic colors, gradient borders, and animations live here. The component code will use only `className`/`cn()` — zero `style={{}}` props.

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add tokens to `:root`**

Insert after `--surface-selected` in `:root`:

```css
  /* ─── Onboarding tokens ─── */
  --onboarding-border: rgba(255, 255, 255, 0.07);
  --onboarding-glow-opacity: 0.28;
  --btn-circle-bg: #f0f0f0;    /* spec: "buttons stay white" — intentionally opaque */
  --btn-circle-stroke: #111111; /* spec: dark chevron against white button */

  /* Per-slide gradient palettes (icon strokes, glows, dots, borders) */
  --gradient-s1: linear-gradient(135deg, #ff6b6b, #ff9a3c, #ffd166); /* coral → amber → gold */
  --gradient-s2: linear-gradient(135deg, #00e5c0, #00aaff, #6e56cf); /* teal → cyan → indigo */
  --gradient-s3: linear-gradient(135deg, #b58aff, #e056a8, #ff6b6b); /* lavender → violet → rose */
  --gradient-s4: linear-gradient(135deg, #ff9a3c, #e056a8, #6e56cf); /* full spectrum */
```

- [ ] **Step 2: Expose new tokens to Tailwind via `@theme inline`**

Add inside the existing `@theme inline { }` block:

```css
  --color-btn-circle-bg: var(--btn-circle-bg);
  --color-btn-circle-stroke: var(--btn-circle-stroke);
```

This unlocks `bg-btn-circle-bg` and `stroke-btn-circle-stroke` as Tailwind classes.

- [ ] **Step 3: Add onboarding CSS utility classes (after the existing `@utility` blocks)**

```css
/* ── Onboarding: ambient glow (per-slide gradient backgrounds) ── */
/* Each class sets the gradient; .ob-glow sets opacity + blur       */
.ob-glow    { opacity: var(--onboarding-glow-opacity); filter: blur(24px); }
.ob-glow-s1 { background: var(--gradient-s1); }
.ob-glow-s2 { background: var(--gradient-s2); }
.ob-glow-s3 { background: var(--gradient-s3); }
.ob-glow-s4 { background: var(--gradient-s4); }

/* ── Onboarding: icon ring shadow ─────────────────────────────── */
.ob-icon-ring { box-shadow: 0 0 0 1px var(--onboarding-border); }

/* ── Onboarding: gradient border (padding-box/border-box trick) ─ */
/* Used by OrbVisual (s2) outer ring and CaptionVisual (s3) pill   */
.ob-grad-border-s2 {
  border: 1.5px solid transparent;
  background:
    linear-gradient(var(--background), var(--background)) padding-box,
    var(--gradient-s2) border-box;
}
.ob-grad-border-s3 {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--background), var(--background)) padding-box,
    var(--gradient-s3) border-box;
}

/* ── Onboarding: gradient fills (orb inner, dots) ─────────────── */
.ob-fill-s1 { background: var(--gradient-s1); }
.ob-fill-s2 { background: var(--gradient-s2); }
.ob-fill-s3 { background: var(--gradient-s3); }
.ob-fill-s4 { background: var(--gradient-s4); }

/* ── Onboarding: dialog border ────────────────────────────────── */
.ob-dialog-border { border: 1px solid var(--onboarding-border); }

/* ── Onboarding: waveform bar animation ───────────────────────── */
@keyframes obWaveBar {
  from { transform: scaleY(0.3); }
  to   { transform: scaleY(1); }
}
.ob-wave-bar {
  transform-origin: bottom;
  animation: obWaveBar 0.8s ease-in-out infinite alternate;
}
/* Staggered delays via nth-child — no inline styles needed */
.ob-wave-bar:nth-child(1)  { animation-delay: 0s; }
.ob-wave-bar:nth-child(2)  { animation-delay: 0.06s; }
.ob-wave-bar:nth-child(3)  { animation-delay: 0.12s; }
.ob-wave-bar:nth-child(4)  { animation-delay: 0.18s; }
.ob-wave-bar:nth-child(5)  { animation-delay: 0.24s; }
.ob-wave-bar:nth-child(6)  { animation-delay: 0.30s; }
.ob-wave-bar:nth-child(7)  { animation-delay: 0.36s; }
.ob-wave-bar:nth-child(8)  { animation-delay: 0.42s; }
.ob-wave-bar:nth-child(9)  { animation-delay: 0.48s; }
.ob-wave-bar:nth-child(10) { animation-delay: 0.54s; }
.ob-wave-bar:nth-child(11) { animation-delay: 0.60s; }
.ob-wave-bar:nth-child(12) { animation-delay: 0.66s; }
```

- [ ] **Step 4: Verify no build error**

```bash
cd apps/web && pnpm build 2>&1 | tail -5
```
Expected: no CSS parse errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(onboarding): add CSS tokens, Tailwind entries, utility classes, and keyframe"
```

---

## Task 2: Bootstrap shadcn + add Dialog

shadcn has NOT been initialised yet. This is a one-time project bootstrap.

**Files:**
- Create: `apps/web/components.json` (by shadcn init)
- Create: `apps/web/src/components/ui/dialog.tsx` (by shadcn add)

- [ ] **Step 1: Run shadcn init from apps/web/**

```bash
cd apps/web
npx shadcn@latest init
```

When prompted, choose:
- Style: **default**
- Base colour: **neutral**
- CSS variables: **yes**
- Tailwind config path: **tailwind.config.ts**

- [ ] **Step 2: Check for clobbered tokens — CRITICAL**

```bash
git diff apps/web/src/app/globals.css
```

shadcn init often overwrites `:root` with its own variable set and adds `@layer base` blocks that shadow the project's existing tokens. **Revert all changes to `globals.css` from shadcn** — only `components.json` is wanted from this step:

```bash
git checkout -- apps/web/src/app/globals.css
```

Also check `tailwind.config.ts` — shadcn may add `darkMode` or `plugins` entries. Keep any additions that don't conflict.

- [ ] **Step 3: Add Dialog component**

```bash
cd apps/web && npx shadcn@latest add dialog
```

Expected output: creates `src/components/ui/dialog.tsx`, installs `@radix-ui/react-dialog`.

- [ ] **Step 4: Remove the default close button from DialogContent**

Open `apps/web/src/components/ui/dialog.tsx`. Find and **delete** the `<DialogPrimitive.Close>` button element inside `DialogContent`. shadcn components are source code — editing is expected and encouraged. We render our own `×` button.

- [ ] **Step 5: Verify TypeScript resolves**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -i dialog
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components.json apps/web/src/components/ui/ apps/web/package.json pnpm-lock.yaml apps/web/tailwind.config.ts
git commit -m "chore: bootstrap shadcn, add Dialog component"
```

---

## Task 3: `useOnboarding` hook — TDD

**Files:**
- Create: `apps/web/src/__tests__/useOnboarding.test.ts`
- Create: `apps/web/src/hooks/useOnboarding.ts`

- [ ] **Step 1: Create the test file**

```ts
// apps/web/src/__tests__/useOnboarding.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '@/hooks/useOnboarding';

const LS_KEY = 'ordio_onboarded';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('opens dialog when localStorage key is absent', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(true);
  });

  it('does NOT open when already onboarded', async () => {
    localStorage.setItem(LS_KEY, 'true');
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(false);
  });

  it('starts at step 0', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.step).toBe(0);
  });

  it('next() advances step', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
  });

  it('next() advances to step 3 then clamps — slide 4 button calls dismiss()', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    act(() => result.current.next()); // 0 → 1
    act(() => result.current.next()); // 1 → 2
    act(() => result.current.next()); // 2 → 3
    act(() => result.current.next()); // stays at 3 (clamp)
    expect(result.current.step).toBe(3);
  });

  it('dismiss() closes dialog and sets localStorage', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBe('true');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/web && pnpm test -- useOnboarding 2>&1 | tail -20
```
Expected: `Cannot find module '@/hooks/useOnboarding'`

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/src/hooks/useOnboarding.ts
import { useState, useEffect } from 'react';

const LS_KEY = 'ordio_onboarded';
const TOTAL_STEPS = 4;

export interface UseOnboardingReturn {
  open: boolean;
  step: number;
  next: () => void;    // advances 0→1→2→3; slide 3's CircleButton calls dismiss() instead of next()
  dismiss: () => void; // sets ordio_onboarded + closes; used by ×, skip, and slide 3 done button
}

export function useOnboarding(): UseOnboardingReturn {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // SSR-safe: localStorage is browser-only; must be inside useEffect
    if (localStorage.getItem(LS_KEY) !== 'true') {
      setOpen(true);
    }
  }, []);

  const next = () => {
    // Advances through steps 0–3; clamps at TOTAL_STEPS - 1 (index 3)
    // Step 3 (slide 4) IS reachable via next() — its CircleButton calls dismiss(), not next()
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const dismiss = () => {
    localStorage.setItem(LS_KEY, 'true');
    setOpen(false);
  };

  return { open, step, next, dismiss };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/web && pnpm test -- useOnboarding 2>&1 | tail -20
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__/useOnboarding.test.ts apps/web/src/hooks/useOnboarding.ts
git commit -m "feat(onboarding): add useOnboarding hook with localStorage persistence"
```

---

## Task 4: `OnboardingDialog` component

**Files:**
- Create: `apps/web/src/components/soul/OnboardingDialog.tsx`

**Reference:** Spec at `docs/superpowers/specs/2026-03-21-onboarding-design.md`

### Key implementation rules (read before coding)

1. **No `style={{}}` props** — all styling uses `className`/`cn()` with Tailwind classes or the `.ob-*` utility classes defined in Task 1.
2. **SVG gradient defs once** — `<GradientDefs>` defines `<linearGradient id="grad-s1">` through `<grad-s4>`. Icon paths and bar fills reference `url(#grad-sN)`. SVG presentation attributes (`stroke`, `fill`) are SVG-specific attributes, not React style props — they are acceptable.
3. **Token-only colors** — `--tertiary` is used for inactive dots (the project has no `--muted` token; `--tertiary` is the intentional substitute. Do NOT add a `--muted` token).
4. **`--btn-circle-*` opacity note** — `#f0f0f0 / #111111` are opaque values per spec ("buttons stay white"). This is intentional and documented in the token definitions in Task 1.
5. **Component tree must match spec** — `AmbientGlow`, `IconRing`, `SlideVisual`, `SlideFooter` (named), `DotProgress`, `CircleButton`.
6. **Dialog non-dismissible** — `onInteractOutside={(e) => e.preventDefault()}` + `onEscapeKeyDown={(e) => e.preventDefault()}`.
7. **× button on all slides** — top-right corner, calls `dismiss()`.

- [ ] **Step 1: Create OnboardingDialog.tsx**

```tsx
// apps/web/src/components/soul/OnboardingDialog.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils'; // shadcn installs this in Task 2
import { useOnboarding } from '@/hooks/useOnboarding';

/* ── Slide data ───────────────────────────────────────────── */
const SLIDES = [
  {
    title: 'Your voice, ready to share',
    body: 'Record or upload audio. Ordio turns it into a polished, captioned video.',
  },
  {
    title: 'Tap the orb to begin',
    body: 'Speak naturally. Or upload an MP3, WAV, or M4A — up to 50 MB.',
  },
  {
    title: 'Captions, automatically',
    body: 'AI transcribes every word and syncs captions to your audio. No editing required.',
  },
  {
    title: 'Not just a waveform',
    body: 'Swap styles in the export screen — graphic frames, bars, circle, spectrogram.',
  },
];

/* ── Hidden SVG gradient defs ─────────────────────────────── */
// Defined once at component top; referenced by id throughout (url(#grad-sN))
function GradientDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute overflow-hidden" focusable="false">
      <defs>
        <linearGradient id="grad-s1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff6b6b" />
          <stop offset="50%"  stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="grad-s2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00e5c0" />
          <stop offset="50%"  stopColor="#00aaff" />
          <stop offset="100%" stopColor="#6e56cf" />
        </linearGradient>
        <linearGradient id="grad-s3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#b58aff" />
          <stop offset="50%"  stopColor="#e056a8" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
        <linearGradient id="grad-s4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff9a3c" />
          <stop offset="50%"  stopColor="#e056a8" />
          <stop offset="100%" stopColor="#6e56cf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Ambient glow ─────────────────────────────────────────── */
// Uses .ob-glow (opacity + blur) + .ob-glow-sN (gradient background)
// Both classes defined in globals.css — no style prop needed
function AmbientGlow({ step }: { step: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute top-0 left-0 right-0 h-28 rounded-t-[20px] pointer-events-none',
        'ob-glow',
        `ob-glow-s${step + 1}`,
      )}
    />
  );
}

/* ── Icon ring ────────────────────────────────────────────── */
// SVG stroke/fill are SVG presentation attributes — not React style props
// ob-icon-ring provides the box-shadow via CSS class
function IconRing({ step }: { step: number }) {
  const gradRef = `url(#grad-s${step + 1})`;

  const icons = [
    // Microphone
    <path
      key="mic"
      d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4zm0 16a8 8 0 008-8h-2a6 6 0 01-12 0H4a8 8 0 008 8zm0 0v3m-4 0h8"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
    // Circle / target
    <g key="target">
      <circle cx="12" cy="12" r="9" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="none" />
    </g>,
    // Speech bubble
    <path
      key="bubble"
      d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 3V6z"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
    // Pencil / edit
    <path
      key="pencil"
      d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
  ];

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative bg-background ob-icon-ring"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <g stroke={gradRef}>{icons[step]}</g>
      </svg>
    </motion.div>
  );
}

/* ── Slide visuals ────────────────────────────────────────── */

// Slide 1: animated waveform bars
// Animation keyframe and stagger delays are in globals.css (.ob-wave-bar + nth-child)
function WaveformVisual() {
  const barHeights = [40, 70, 55, 90, 65, 80, 45, 75, 60, 85, 50, 70];
  return (
    <div className="flex items-end justify-center my-4" aria-hidden="true">
      <svg width="140" height="24" viewBox="0 0 140 24">
        {barHeights.map((h, i) => {
          const barH = (h / 100) * 24;
          return (
            <rect
              key={i}
              x={i * 11 + 3}
              y={24 - barH}
              width="3.5"
              height={barH}
              rx="2"
              fill="url(#grad-s1)"
              className="ob-wave-bar"
            />
          );
        })}
      </svg>
    </div>
  );
}

// Slide 2: mini orb with pulsing gradient ring
// ob-grad-border-s2 handles the gradient border without inline style
// ob-fill-s2 handles the inner gradient fill
function OrbVisual() {
  return (
    <div className="flex items-center justify-center my-4" aria-hidden="true">
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        className="relative flex items-center justify-center w-[54px] h-[54px]"
      >
        <div className="absolute inset-0 rounded-full ob-grad-border-s2" />
        <div className="rounded-full w-[34px] h-[34px] opacity-25 ob-fill-s2" />
      </motion.div>
    </div>
  );
}

// Slide 3: caption pill with gradient border
// ob-grad-border-s3 handles the gradient border without inline style
function CaptionVisual() {
  return (
    <div className="my-4 w-full" aria-hidden="true">
      <div className="rounded-full px-3 py-2 text-[length:var(--text-caption)] text-secondary ob-grad-border-s3">
        "AI transcribes every word..."
      </div>
    </div>
  );
}

// Slide 4: 2×2 style tiles — each tile icon references its own gradient from GradientDefs
const STYLE_TILES = [
  { label: 'Bars',     gradId: 'grad-s1' },
  { label: 'Circle',   gradId: 'grad-s2' },
  { label: 'Frame',    gradId: 'grad-s3' },
  { label: 'Spectrum', gradId: 'grad-s4' },
];

function StyleTilesVisual() {
  return (
    <div className="grid grid-cols-2 gap-[5px] my-4 w-full" aria-hidden="true">
      {STYLE_TILES.map(({ label, gradId }) => (
        <div
          key={label}
          className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 bg-surface"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="3" strokeWidth="1.5" stroke={`url(#${gradId})`} />
          </svg>
          <span className="text-[length:var(--text-footnote)] text-tertiary tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}

function SlideVisual({ step }: { step: number }) {
  if (step === 0) return <WaveformVisual />;
  if (step === 1) return <OrbVisual />;
  if (step === 2) return <CaptionVisual />;
  return <StyleTilesVisual />;
}

/* ── Progress dots ────────────────────────────────────────── */
// Active dot: .ob-fill-sN (gradient background) + w-3 (12px pill)
// Inactive dot: bg-tertiary + w-1.5 (6px circle)
// No --muted token in this project; --tertiary is the intentional substitute
function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-[6px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-[2px] transition-all duration-200',
            i === step
              ? cn('w-3', `ob-fill-s${step + 1}`)
              : 'w-1.5 bg-tertiary',
          )}
        />
      ))}
    </div>
  );
}

/* ── Circle button ────────────────────────────────────────── */
// bg-btn-circle-bg and stroke-btn-circle-stroke are Tailwind classes
// exposed via @theme inline in globals.css (added in Task 1)
function CircleButton({ isDone, onClick }: { isDone: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={isDone ? 'Get started' : 'Next'}
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-btn-circle-bg"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--btn-circle-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDone ? <path d="M5 12l5 5L20 7" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

/* ── Slide footer (named component per spec) ─────────────── */
function SlideFooter({
  step,
  total,
  onNext,
  onDismiss,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const isDone = step === total - 1;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <DotProgress step={step} total={total} />
        <CircleButton isDone={isDone} onClick={isDone ? onDismiss : onNext} />
      </div>
      {step === 0 && (
        <button
          onClick={onDismiss}
          className="mt-3 text-center text-[length:var(--text-caption)] text-tertiary hover:text-secondary transition-colors w-full"
        >
          Skip intro
        </button>
      )}
    </div>
  );
}

/* ── Single slide ─────────────────────────────────────────── */
function OnboardingSlide({
  step,
  total,
  onNext,
  onDismiss,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const slide = SLIDES[step];

  return (
    <motion.div
      key={step}
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -32, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex flex-col"
    >
      <AmbientGlow step={step} />

      <IconRing step={step} />

      <DialogTitle className="text-[length:var(--text-h5)] font-semibold text-primary leading-[var(--leading-heading)] mb-2">
        {slide.title}
      </DialogTitle>

      <DialogDescription className="text-[length:var(--text-body-sm)] text-secondary leading-[var(--leading-body)] mb-1">
        {slide.body}
      </DialogDescription>

      <SlideVisual step={step} />

      <SlideFooter step={step} total={total} onNext={onNext} onDismiss={onDismiss} />
    </motion.div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function OnboardingDialog() {
  const { open, step, next, dismiss } = useOnboarding();

  return (
    <>
      <GradientDefs />

      <Dialog open={open}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="relative overflow-hidden p-[24px_20px_18px] rounded-[20px] max-w-[340px] w-[calc(100vw-32px)] ob-dialog-border"
        >
          {/* × dismiss button — always visible on all slides */}
          <button
            onClick={dismiss}
            aria-label="Close onboarding"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-secondary transition-colors z-10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <AnimatePresence mode="wait">
            <OnboardingSlide
              key={step}
              step={step}
              total={SLIDES.length}
              onNext={next}
              onDismiss={dismiss}
            />
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Check if `@/lib/utils` exists**

```bash
ls apps/web/src/lib/utils.ts 2>/dev/null || echo "missing"
```

shadcn creates `src/lib/utils.ts` with `cn()` during `init`. If missing (e.g., it was created at a different path), check `apps/web/src/lib/` for the cn utility and update the import accordingly.

- [ ] **Step 3: Fix TypeScript if needed**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

Common issues:
- `focusable` prop on SVG — if TS complains, replace with `aria-hidden="true"` only and remove `focusable`
- `ob-wave-bar` className on SVG `<rect>` — if Tailwind purges it or TS SVG types reject it, use a wrapping `<g className="ob-wave-bar">` instead

- [ ] **Step 4: Verify clean build**

```bash
cd apps/web && pnpm build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/OnboardingDialog.tsx
git commit -m "feat(onboarding): add OnboardingDialog component (4 slides, Framer Motion)"
```

---

## Task 5: Wire up — export + integrate

**Files:**
- Modify: `apps/web/src/components/soul/index.ts`
- Modify: `apps/web/src/app/create/page.tsx`

- [ ] **Step 1: Confirm soul/index.ts exists**

```bash
cat apps/web/src/components/soul/index.ts
```
Expected: file exists with existing exports.

- [ ] **Step 2: Export OnboardingDialog**

Append to `apps/web/src/components/soul/index.ts`:

```ts
export { default as OnboardingDialog } from './OnboardingDialog';
```

- [ ] **Step 3: Import and render in create/page.tsx**

Add `OnboardingDialog` to the existing soul import:

```ts
import {
  AuthGate,
  IdleState,
  RecordingState,
  ProcessingState,
  ExportState,
  UpgradeSheet,
  OnboardingDialog,   // ← add
} from '@/components/soul';
```

Render it inside `CreateContent`'s JSX, after `<UpgradeSheet>`:

```tsx
      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
        onUpgrade={() => startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))}
      />

      {/* First-time onboarding — Dialog overlay, no AppPhase change */}
      <OnboardingDialog />
```

- [ ] **Step 4: Full test suite — all must pass**

```bash
cd apps/web && pnpm test 2>&1 | tail -10
```
Expected: all existing tests pass + 5 useOnboarding tests pass.

- [ ] **Step 5: Type check**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/index.ts apps/web/src/app/create/page.tsx
git commit -m "feat(onboarding): wire up OnboardingDialog to create page"
```

---

## Manual Smoke Test Checklist

After implementation, verify in the browser (`pnpm dev`):

- [ ] Navigate to `/create` — onboarding dialog appears over blurred idle screen
- [ ] Slide 1: mic icon, "Your voice, ready to share", animated bars, "Skip intro" link
- [ ] Arrow → advances through slides 2 and 3
- [ ] Slide 4: pencil icon, 2×2 style tiles, checkmark button
- [ ] Checkmark closes dialog; returns to idle state
- [ ] Refresh — dialog does NOT reappear (`ordio_onboarded` in localStorage)
- [ ] Clear localStorage → refresh — dialog reappears
- [ ] × button on any slide closes dialog and sets `ordio_onboarded`
- [ ] Escape key and clicking outside do NOT close the dialog
- [ ] "Skip intro" on slide 1 closes dialog
- [ ] Framer Motion slide transitions are smooth (0.3s, no flash)
- [ ] Gradient colors vibrant on each slide — coral/amber, teal/indigo, violet/rose, full spectrum
- [ ] No TypeScript errors in console
