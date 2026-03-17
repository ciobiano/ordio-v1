# App UI/UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 4 app states (idle/recording/processing/export) with a monochrome design system, iridescent VAD-driven orb, CapCut-style icon toolbar, and text-based audio trimming.

**Architecture:** Monochrome UI (`#FAF8F5` warm off-white on `#000` OLED black) with a single colorful hero element — an iridescent CSS orb driven by voice activity detection. The export screen uses an icon toolbar pattern (one panel visible at a time) replacing the current vertically stacked controls. A new non-destructive audio trimmer leverages existing Whisper word-level timestamps for text-based editing.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, CVA + CLSX, Zustand, Vitest, CSS animations (conic-gradient + blur for orb)

**Spec:** `docs/superpowers/specs/2026-03-14-app-ui-ux-redesign-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/components/primitives/Orb.tsx` | Iridescent CSS sphere — 3 states (dormant/active/resting), VAD intensity prop |
| `apps/web/src/components/soul/RecordingSettingsSheet.tsx` | Bottom sheet modal — waveform style, caption style, enhancement tier |
| `apps/web/src/components/primitives/IconToolbar.tsx` | Horizontal icon bar — manages active panel state for export screen |
| `apps/web/src/components/soul/TrimPanel.tsx` | Timeline waveform handles + word deletion interface |
| `apps/web/src/hooks/useAudioTrimmer.ts` | Non-destructive trim state — start/end times, deleted word indices, export-time splicing |
| `apps/web/src/__tests__/useAudioTrimmer.test.ts` | Tests for trim hook — splicing, filtering, timestamp rebasing |
| `apps/web/src/__tests__/Orb.test.tsx` | Tests for orb component — state transitions, accessibility, VAD prop |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | Replace design tokens with new monochrome system |
| `apps/web/src/lib/variants.ts` | Update `roundIconBtn` stop variant, add new recording button variants |
| `apps/web/src/lib/store.ts` | Fix `setFormat('instagram')` bug (1080x1350) |
| `apps/web/src/components/soul/IdleState.tsx` | Rewrite — dormant orb replaces WaveformDisplay + mic button |
| `apps/web/src/components/soul/RecordingState.tsx` | Rewrite — centered orb + 3-button bar + stop checkpoint |
| `apps/web/src/components/soul/ExportState.tsx` | Rewrite — icon toolbar + panel pattern replaces stacked layout |
| `apps/web/src/components/soul/CaptionEditor.tsx` | Add trim mode — word selection + deletion with strikethrough |
| `apps/web/src/components/soul/StyleControls.tsx` | Restructure for panel format (remove collapsible wrapper) |
| `apps/web/src/components/soul/FormatToggle.tsx` | Restructure for panel format + add LockBadge support |
| `apps/web/src/components/primitives/PlaybackControls.tsx` | Simplify — remove play button (moves to preview overlay) |
| `apps/web/src/app/page.tsx` | Remove auto-process useEffect, remove StyleModeSelector/CaptionStyleSelector, update transitions |

### Deleted Files (no longer rendered)
- `apps/web/src/components/soul/StyleModeSelector.tsx` — removed from page.tsx render (waveform style moves to RecordingSettingsSheet)
- `apps/web/src/components/soul/AudioSettings.tsx` — removed from idle layout (enhancement tier moves to RecordingSettingsSheet)

### Files That Stay Unchanged
- `apps/web/src/components/primitives/CanvasPreview.tsx`
- `apps/web/src/lib/frameRenderer.ts`, `renderFrame()`
- `apps/web/src/components/soul/ProcessingState.tsx`
- `apps/web/src/hooks/useAudioRecorder.ts` (already has pause/resume/reset)
- `apps/web/src/hooks/useVAD.ts`
- `apps/web/src/lib/fontLoader.ts`
- `packages/shared/src/waveform.ts`

---

## Chunk 1: Foundation

### Task 1: Update Design Tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Read current globals.css**

Read: `apps/web/src/app/globals.css`
Understand current token names and values at lines 3-26.

- [ ] **Step 2: Replace design tokens**

Replace the CSS custom properties block (lines 3-26) with the new monochrome system:

```css
  /* ─── Design tokens ─── */
  --background: #000000;
  --foreground: #FAF8F5;
  --primary: #FAF8F5;
  --secondary: rgba(250, 248, 245, 0.5);
  --tertiary: rgba(250, 248, 245, 0.3);
  --surface: rgba(255, 255, 255, 0.04);
  --surface-hover: rgba(255, 255, 255, 0.08);
  --surface-active: rgba(255, 255, 255, 0.12);
  --border: rgba(255, 255, 255, 0.06);
  --border-active: rgba(255, 255, 255, 0.12);
  --destructive: #e11d48;
  --accent: #FAF8F5;
  --accent-purple: #FAF8F5;
  --accent-red: #e11d48;
```

Remove old `--surface-1`, `--surface-2`, `--surface-3` tokens. Keep `--accent` and `--accent-purple` pointing to `#FAF8F5` for backwards compatibility with any components not yet migrated.

- [ ] **Step 3: Update Tailwind theme extension**

Update the `@theme inline` block (lines 28-45) to expose the new tokens:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-secondary: var(--secondary);
  --color-tertiary: var(--tertiary);
  --color-surface: var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-surface-active: var(--surface-active);
  --color-border: var(--border);
  --color-border-active: var(--border-active);
  --color-destructive: var(--destructive);
  --color-accent: var(--accent);
}
```

- [ ] **Step 4: Update focus states**

Update focus ring (lines 77-83) to use warm off-white:

```css
*:focus-visible {
  outline: 2px solid rgba(250, 248, 245, 0.8);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(250, 248, 245, 0.15);
}
```

- [ ] **Step 5: Run type-check and verify no build errors**

Run: `pnpm --filter=web type-check`
Expected: PASS (CSS changes don't affect types, but verify Tailwind picks up new tokens)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "refactor: replace design tokens with monochrome system (#FAF8F5 warm off-white)"
```

---

### Task 2: Create Orb Component

**Files:**
- Create: `apps/web/src/components/primitives/Orb.tsx`
- Create: `apps/web/src/__tests__/Orb.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/Orb.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Orb } from '../components/primitives/Orb'

describe('Orb', () => {
  it('renders as a button with accessible label when onClick provided', () => {
    render(<Orb state="dormant" intensity={0} onClick={() => {}} ariaLabel="Start recording" />)
    const button = screen.getByRole('button', { name: 'Start recording' })
    expect(button).toBeDefined()
  })

  it('renders as a div when no onClick provided', () => {
    const { container } = render(<Orb state="active" intensity={0.5} />)
    const button = container.querySelector('button')
    expect(button).toBeNull()
  })

  it('applies dormant state class', () => {
    const { container } = render(<Orb state="dormant" intensity={0} />)
    const orb = container.firstElementChild as HTMLElement
    expect(orb.dataset.state).toBe('dormant')
  })

  it('applies active state class', () => {
    const { container } = render(<Orb state="active" intensity={0.8} />)
    const orb = container.firstElementChild as HTMLElement
    expect(orb.dataset.state).toBe('active')
  })

  it('applies resting state class', () => {
    const { container } = render(<Orb state="resting" intensity={0} />)
    const orb = container.firstElementChild as HTMLElement
    expect(orb.dataset.state).toBe('resting')
  })

  it('sets --orb-intensity CSS variable from intensity prop', () => {
    const { container } = render(<Orb state="active" intensity={0.75} />)
    const orb = container.firstElementChild as HTMLElement
    expect(orb.style.getPropertyValue('--orb-intensity')).toBe('0.75')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=web vitest run src/__tests__/Orb.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the Orb component**

Create `apps/web/src/components/primitives/Orb.tsx`:

```tsx
'use client'

import { cn } from '@/lib/cn'

interface OrbProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
  onClick?: () => void
  ariaLabel?: string
  className?: string
}

export function Orb({ state, intensity, onClick, ariaLabel, className }: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

  const content = (
    <>
      {/* Outer glow ring — opacity driven by intensity in active state */}
      <div
        className={cn(
          'absolute -inset-7 rounded-full transition-opacity duration-600',
          state === 'dormant' && 'opacity-30',
          state === 'resting' && 'opacity-20'
        )}
        style={{
          background:
            'radial-gradient(circle, rgba(255,180,200,0.15) 0%, transparent 70%)',
          opacity: state === 'active' ? 0.6 + clampedIntensity * 0.4 : undefined,
        }}
      />

      {/* Core orb */}
      <div
        className={cn(
          'relative z-10 w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full overflow-hidden transition-all duration-600',
          state === 'dormant' && 'animate-[orbBreathe_6s_ease-in-out_infinite]',
          state === 'resting' && 'scale-95 opacity-70'
        )}
        style={{
          boxShadow:
            state === 'active'
              ? `0 0 ${40 + clampedIntensity * 40}px rgba(255,180,200,${0.1 + clampedIntensity * 0.15}), 0 0 ${60 + clampedIntensity * 60}px rgba(120,200,220,${0.05 + clampedIntensity * 0.08})`
              : '0 0 30px rgba(255,180,200,0.1)',
          transform: state === 'active' ? `scale(${1 + clampedIntensity * 0.12})` : undefined,
        }}
      >
        {/* Rotating iridescent gradient */}
        <div
          className={cn(
            'absolute -inset-5 rounded-full',
            state === 'dormant' && 'animate-[orbRotate_12s_linear_infinite]',
            state === 'active' && 'animate-[orbRotate_4s_linear_infinite]',
            state === 'resting' && 'animate-none'
          )}
          style={{
            background:
              'conic-gradient(from 0deg, rgba(255,190,210,0.7), rgba(160,220,230,0.6), rgba(255,200,170,0.7), rgba(200,180,240,0.5), rgba(255,190,210,0.7))',
            filter: state === 'resting' ? 'blur(24px)' : state === 'dormant' ? 'blur(22px)' : 'blur(18px)',
          }}
        />

        {/* Specular highlight for 3D depth */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
          }}
        />

        {/* Glass rim */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid rgba(255,255,255,0.15)' }}
        />
      </div>
    </>
  )

  const sharedProps = {
    'data-state': state,
    className: cn('relative flex items-center justify-center', className),
    style: { '--orb-intensity': clampedIntensity } as React.CSSProperties,
  }

  if (onClick) {
    return (
      <button {...sharedProps} onClick={onClick} aria-label={ariaLabel} type="button">
        {content}
      </button>
    )
  }

  return <div {...sharedProps}>{content}</div>
}
```

- [ ] **Step 4: Add orb animations to globals.css**

Add to `globals.css` after the existing `@keyframes popIn` block:

```css
@keyframes orbRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes orbGlow {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
}

@keyframes orbBreathe {
  0%, 100% { transform: scale(0.98); }
  50% { transform: scale(1.02); }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter=web vitest run src/__tests__/Orb.test.tsx`
Expected: ALL PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/primitives/Orb.tsx apps/web/src/__tests__/Orb.test.tsx apps/web/src/app/globals.css
git commit -m "feat: add iridescent Orb component with VAD-driven state machine"
```

---

### Task 3: Verify setFormat Instagram Bug Is Fixed

**Files:**
- Verify: `apps/web/src/lib/store.ts`

> **Note:** This bug was already fixed in the current codebase. `getCanvasDimensions()` already has `case 'instagram': return { width: 1080, height: 1350 }`. This task is a verification step only.

- [ ] **Step 1: Read current setFormat implementation and verify fix**

Read: `apps/web/src/lib/store.ts` — confirm `getCanvasDimensions()` has a `case 'instagram': return { width: 1080, height: 1350 }` entry.

If the fix is already present: skip to Step 3.
If missing: add the case and commit.

- [ ] **Step 2: Add regression test**

Add to the existing store tests or create inline verification:

```typescript
it('getCanvasDimensions returns 1080x1350 for instagram', () => {
  const dims = getCanvasDimensions('instagram')
  expect(dims).toEqual({ width: 1080, height: 1350 })
})
```

- [ ] **Step 3: Run existing tests**

Run: `pnpm --filter=web vitest run`
Expected: ALL PASS

---

### Task 4: Update Button Variants

**Files:**
- Modify: `apps/web/src/lib/variants.ts`

- [ ] **Step 1: Read current variants.ts**

Read: `apps/web/src/lib/variants.ts` — understand existing `roundIconBtn` and `primaryBtn` variants.

- [ ] **Step 2: Update roundIconBtn for new recording buttons**

Update the `roundIconBtn` CVA to include the new recording button intents. Add these intent values:

```typescript
export const roundIconBtn = cva(
  'flex items-center justify-center rounded-full transition-all duration-150',
  {
    variants: {
      intent: {
        idle: 'w-16 h-16 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        pause: 'w-12 h-12 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        settings: 'w-12 h-12 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        stop: 'w-16 h-16 bg-[rgba(225,29,72,0.15)] border-2 border-[rgba(225,29,72,0.6)] text-destructive hover:bg-[rgba(225,29,72,0.25)]',
      },
    },
    defaultVariants: {
      intent: 'idle',
    },
  }
)
```

The `stop` variant is 64px (`w-16 h-16`) with the exact spec colors: `rgba(225,29,72,0.15)` background, `rgba(225,29,72,0.6)` border. The `pause` and `settings` variants are 48px (`w-12 h-12`) with `--surface` backgrounds.

- [ ] **Step 3: Add proceed button variant**

Add a `proceedBtn` variant with the CTA colors baked into the CVA (per project rule: never use inline style props, use CVA + CLSX):

```typescript
export const proceedBtn = cva(
  'w-full rounded-[12px] font-semibold tracking-tight transition-all duration-150 bg-[#FAF8F5] text-black',
  {
    variants: {
      size: {
        default: 'py-3.5 text-[14px]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)
```

Note: `bg-[#FAF8F5] text-black` are in the CVA base class, not applied inline. This satisfies the hard project rule "NEVER use inline style props — use CVA + CLSX for all variants."

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/variants.ts
git commit -m "refactor: update button variants for monochrome recording controls"
```

---

## Chunk 2: Recording Flow

### Task 5: Create RecordingSettingsSheet

**Files:**
- Create: `apps/web/src/components/soul/RecordingSettingsSheet.tsx`

- [ ] **Step 1: Read existing StyleModeSelector, AudioSettings, and CaptionStyleSelector**

Read these 3 files to understand:
- `apps/web/src/components/soul/StyleModeSelector.tsx` — waveform + graphic style data (line 76-106)
- `apps/web/src/components/soul/AudioSettings.tsx` — enhance tier data (lines 12-21)
- `apps/web/src/components/soul/CaptionStyleSelector.tsx` — caption style data (lines 12-16)

The settings sheet consolidates all three into one bottom sheet.

- [ ] **Step 2: Create the RecordingSettingsSheet component**

Create `apps/web/src/components/soul/RecordingSettingsSheet.tsx`:

```tsx
'use client'

import { useEffect, useRef, useCallback, type React } from 'react'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/lib/store'
import { LockBadge } from '@/components/primitives/LockBadge'
import type { FeatureKey } from '@/lib/featureGates'
import type { WaveformVariant, CaptionVariant, EnhanceTier, GraphicStyleId } from '@/lib/store'

interface RecordingSettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  onLocked: (feature: FeatureKey) => void
}

const WAVEFORM_OPTIONS: { value: WaveformVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Circle', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'None' },
]

const GRAPHIC_OPTIONS: { value: GraphicStyleId; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
]

const CAPTION_OPTIONS: { value: CaptionVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center' },
  { value: 'karaoke', label: 'Karaoke', gate: 'caption_karaoke' },
]

const ENHANCE_OPTIONS: { value: EnhanceTier; label: string; desc: string; gate?: FeatureKey }[] = [
  { value: 'none', label: 'Standard', desc: 'No processing' },
  { value: 'clean', label: 'Clean', desc: 'AI noise removal (~3s)', gate: 'enhance_clean' },
  { value: 'hd', label: 'HD Remaster', desc: 'Denoise + enhance (~15s)', gate: 'enhance_hd' },
]

export function RecordingSettingsSheet({ isOpen, onClose, onLocked }: RecordingSettingsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const {
    waveformStyle, setWaveformStyle,
    graphicStyle, setGraphicStyle,
    captionStyle, setCaptionStyle,
    enhanceTier, setEnhanceTier,
  } = useAppStore()

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Focus trap — move focus to first interactive element when opened
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return
    const firstBtn = sheetRef.current.querySelector<HTMLButtonElement>('button')
    firstBtn?.focus()

    // Trap Tab within the sheet
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = sheetRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [isOpen])

  // Drag-down to dismiss — track pointer start and close if dragged > 100px down
  const dragStartY = useRef<number | null>(null)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY
  }, [])
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return
      const delta = e.clientY - dragStartY.current
      if (delta > 100) {
        dragStartY.current = null
        onClose()
      }
    },
    [onClose]
  )
  const handlePointerUp = useCallback(() => {
    dragStartY.current = null
  }, [])

  const handleOptionClick = useCallback(
    (gate: FeatureKey | undefined, action: () => void) => {
      if (gate) {
        onLocked(gate)
      } else {
        action()
      }
    },
    [onLocked]
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Recording settings"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#0a0a0a] border-t border-[--border] max-h-[70vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[--surface-hover]" />
        </div>

        <div className="px-5 pb-8 space-y-6">
          {/* Waveform Style */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Waveform Style
            </h3>
            <div className="flex flex-wrap gap-2">
              {WAVEFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-sm transition-colors',
                    waveformStyle === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => setWaveformStyle(opt.value))
                  }
                >
                  {opt.label}
                  {opt.gate && <LockBadge />}
                </button>
              ))}
            </div>
            {/* Graphic styles */}
            <div className="flex flex-wrap gap-2 mt-2">
              {GRAPHIC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm transition-colors',
                    graphicStyle === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() => setGraphicStyle(
                    graphicStyle === opt.value ? null : opt.value
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-[--border]" />

          {/* Caption Position */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Caption Position
            </h3>
            <div className="flex gap-2">
              {CAPTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-sm transition-colors',
                    captionStyle === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => setCaptionStyle(opt.value))
                  }
                >
                  {opt.label}
                  {opt.gate && <LockBadge />}
                </button>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-[--border]" />

          {/* Audio Enhancement */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Audio Enhancement
            </h3>
            <div className="space-y-2">
              {ENHANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    enhanceTier === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => setEnhanceTier(opt.value))
                  }
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    enhanceTier === opt.value ? 'border-[--primary]' : 'border-[--tertiary]'
                  )}>
                    {enhanceTier === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-[--primary]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-[--tertiary]">{opt.desc}</div>
                  </div>
                  {opt.gate && <LockBadge />}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Add slideUp animation to globals.css**

```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/RecordingSettingsSheet.tsx apps/web/src/app/globals.css
git commit -m "feat: add RecordingSettingsSheet — consolidates waveform, caption, enhance settings"
```

---

### Task 6: Rewrite IdleState

**Files:**
- Modify: `apps/web/src/components/soul/IdleState.tsx`

- [ ] **Step 1: Read current IdleState.tsx**

Read: `apps/web/src/components/soul/IdleState.tsx` (86 lines)
Note: Current props interface includes `waveformStyle`, which is no longer needed in idle.

- [ ] **Step 2: Simplify props interface**

The new idle state only needs:
```typescript
interface IdleStateProps {
  onStartRecording: () => void
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void
  canRecord: boolean
  isLoading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
}
```

Remove `waveformStyle` prop — no longer used in idle.

- [ ] **Step 3: Rewrite component body**

Replace the full component body with the dormant orb layout:

```tsx
export function IdleState({
  onStartRecording,
  onFileUpload,
  canRecord,
  isLoading,
  fileInputRef,
}: IdleStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fadeIn">
      {/* Wordmark */}
      <p className="text-[--secondary] text-sm font-light tracking-wide mb-8">
        ord<span className="font-medium">io</span>
      </p>

      {/* Dormant orb — tap to record */}
      <Orb
        state="dormant"
        intensity={0}
        onClick={canRecord && !isLoading ? onStartRecording : undefined}
        ariaLabel="Start recording"
      />

      {/* Mic icon hint */}
      <svg
        className="w-5 h-5 text-[--secondary] mt-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>

      <p className="text-[--primary] text-[15px] font-medium">Tap to record</p>

      {/* Upload option */}
      <button
        type="button"
        className="text-[--secondary] text-[13px] hover:text-[--primary] transition-colors mt-2"
        onClick={() => fileInputRef.current?.click()}
      >
        or upload audio
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  )
}
```

Add `import { Orb } from '@/components/primitives/Orb'` at the top.

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: May show errors in `page.tsx` where `waveformStyle` prop was passed to `IdleState` — fix those in Task 8 (page.tsx update).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/IdleState.tsx
git commit -m "feat: rewrite IdleState — dormant orb replaces waveform + mic button"
```

---

### Task 7: Rewrite RecordingState

**Files:**
- Modify: `apps/web/src/components/soul/RecordingState.tsx`

- [ ] **Step 1: Read current RecordingState.tsx**

Read: `apps/web/src/components/soul/RecordingState.tsx` (159 lines)
Note the `FlowingWaveform` sub-component (lines 19-108) — this will be deleted entirely, replaced by the Orb.

- [ ] **Step 2: Define new props interface**

```typescript
interface RecordingStateProps {
  audioLevel: number
  isPaused: boolean
  recordingTime: number
  onPauseRecording: () => void
  onResumeRecording: () => void
  onStopRecording: () => void
  onRestart: () => void
  onProceed: () => void
  onLocked: (feature: FeatureKey) => void
}
```

- [ ] **Step 3: Rewrite the component**

Delete the entire file contents. Replace with:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { Orb } from '@/components/primitives/Orb'
import { RecordingSettingsSheet } from '@/components/soul/RecordingSettingsSheet'
import { roundIconBtn, proceedBtn } from '@/lib/variants'
import type { FeatureKey } from '@/lib/featureGates'

interface RecordingStateProps {
  audioLevel: number
  isPaused: boolean
  recordingTime: number
  onPauseRecording: () => void
  onResumeRecording: () => void
  onStopRecording: () => void
  onRestart: () => void
  onProceed: () => void
  onLocked: (feature: FeatureKey) => void
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordingState({
  audioLevel,
  isPaused,
  recordingTime,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onRestart,
  onProceed,
  onLocked,
}: RecordingStateProps) {
  const [phase, setPhase] = useState<'recording' | 'stopped'>('recording')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Paused orb stays 'active' at locked 0.7 intensity (not 'dormant' — intensity is ignored in dormant)
  const orbState = phase === 'stopped' ? 'resting' : 'active'
  const orbIntensity = phase === 'stopped' ? 0 : isPaused ? 0.7 : audioLevel

  const handleStop = useCallback(() => {
    setPhase('stopped')
    onStopRecording()
  }, [onStopRecording])

  const handleResume = useCallback(() => {
    setPhase('recording')
    onResumeRecording()
  }, [onResumeRecording])

  const handleRestart = useCallback(() => {
    setPhase('recording')
    onRestart()
  }, [onRestart])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black">
      {/* Center: Orb + Timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Orb state={orbState} intensity={orbIntensity} />

        <p className="text-[--secondary] text-sm font-mono tracking-widest mt-4">
          {phase === 'stopped'
            ? `${formatTime(recordingTime)} recorded`
            : formatTime(recordingTime)}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="w-full px-6 pb-10 pt-4">
        {phase === 'recording' ? (
          /* Active recording: Pause · Stop · Settings */
          <div className="flex items-center justify-center gap-8">
            {/* Pause/Play — 48px */}
            <button
              type="button"
              className={roundIconBtn({ intent: 'pause' })}
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? (
                /* Play triangle */
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <polygon points="5,3 15,9 5,15" />
                </svg>
              ) : (
                /* Pause bars */
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <rect x="4" y="3" width="3.5" height="12" rx="1" />
                  <rect x="10.5" y="3" width="3.5" height="12" rx="1" />
                </svg>
              )}
            </button>

            {/* Stop — 64px */}
            <button
              type="button"
              className={roundIconBtn({ intent: 'stop' })}
              onClick={handleStop}
              aria-label="Stop recording"
            >
              {/* 22px red rounded square */}
              <div className="w-[22px] h-[22px] rounded-[5px] bg-destructive" />
            </button>

            {/* Settings — 48px */}
            <button
              type="button"
              className={roundIconBtn({ intent: 'settings' })}
              onClick={() => setSettingsOpen(true)}
              aria-label="Recording settings"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="2.5" />
                <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.1 3.1l1.4 1.4M13.5 13.5l1.4 1.4M3.1 14.9l1.4-1.4M13.5 4.5l1.4-1.4" />
              </svg>
            </button>
          </div>
        ) : (
          /* Post-stop checkpoint: Proceed CTA + Resume/Restart */
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              className={proceedBtn()}
              onClick={onProceed}
              aria-label="Proceed to editing"
            >
              Proceed
            </button>

            <div className="flex items-center gap-3 text-[13px]">
              <button
                type="button"
                className="text-[--secondary] hover:text-[--primary] transition-colors flex items-center gap-1"
                onClick={handleResume}
                aria-label="Resume recording"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <polygon points="2,1 10,6 2,11" />
                </svg>
                Resume
              </button>

              <span className="text-[--tertiary]">&middot;</span>

              <button
                type="button"
                className="text-[--tertiary] hover:text-[--secondary] transition-colors flex items-center gap-1"
                onClick={handleRestart}
                aria-label="Restart recording"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 6a5 5 0 1 1 1.5 3.5" strokeLinecap="round" />
                  <polyline points="1,3 1,6.5 4,6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Restart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings sheet */}
      <RecordingSettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLocked={onLocked}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: May show errors in `page.tsx` — will fix in Task 8.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/RecordingState.tsx
git commit -m "feat: rewrite RecordingState — centered orb, 3-button bar, stop checkpoint"
```

---

### Task 8: Update page.tsx Orchestrator

**Files:**
- Modify: `apps/web/src/app/page.tsx`

This is the critical integration task. Multiple changes needed:

- [ ] **Step 1: Read current page.tsx**

Read: `apps/web/src/app/page.tsx` (275 lines)
Pay close attention to:
- Lines 104-109: auto-trigger processAudio useEffect
- Lines 183-188: CaptionStyleSelector + UserButton rendering
- Lines 252-256: StyleModeSelector rendering
- Lines 111-121: handleStartRecording / handleStopRecording

- [ ] **Step 2: Remove the auto-process useEffect**

Delete or comment out the useEffect at lines 104-109 that auto-triggers `processAudio` when `recorder.state === 'stopped'`. Processing is now triggered explicitly by the "Proceed" button in RecordingState.

- [ ] **Step 3: Add handleProceed function**

Add a new handler that explicitly triggers the processing pipeline:

```typescript
const handleProceed = useCallback(() => {
  if (!recorder.audioBlob) return
  processAudio(recorder.audioBlob).catch((err) => {
    toast.error(err instanceof Error ? err.message : 'Processing failed')
  })
}, [recorder.audioBlob, processAudio])
```

- [ ] **Step 4: Add handleRestart function**

```typescript
const handleRestart = useCallback(async () => {
  recorder.resetRecording()
  try {
    await handleStartRecording()
  } catch (err) {
    toast.error('Failed to restart recording')
    setCurrentState('idle')
  }
}, [recorder, handleStartRecording, setCurrentState])
```

- [ ] **Step 5: Remove StyleModeSelector from render**

Delete the fixed bottom-right `StyleModeSelector` block (currently around lines 252-256).

- [ ] **Step 6: Remove CaptionStyleSelector from render**

Delete the `CaptionStyleSelector` from the fixed top-right area (currently around lines 183-188). Caption style is now in the RecordingSettingsSheet.

- [ ] **Step 7: Update RecordingState props**

Update the `RecordingState` rendering to pass the new props:

```tsx
{currentState === 'recording' && (
  <RecordingState
    audioLevel={audioLevel}
    isPaused={recorder.isPaused}
    recordingTime={recorder.recordingTime}
    onPauseRecording={recorder.pauseRecording}
    onResumeRecording={recorder.resumeRecording}
    onStopRecording={handleStopRecording}
    onRestart={handleRestart}
    onProceed={handleProceed}
    onLocked={setUpgradeTarget}
  />
)}
```

- [ ] **Step 8: Update IdleState props**

Remove the `waveformStyle` prop from IdleState:

```tsx
{currentState === 'idle' && (
  <IdleState
    onStartRecording={handleStartRecording}
    onFileUpload={handleFileUpload}
    canRecord={capabilities.canRecord}
    isLoading={false}
    fileInputRef={fileInputRef}
  />
)}
```

Remove the `AudioSettings` component that renders below IdleState.

- [ ] **Step 9: Move UserButton to export state or keep minimal**

For now, render UserButton in the top-right for idle and export states only (recording is full-screen immersive):

```tsx
{(currentState === 'idle' || currentState === 'export') && (
  <div className="fixed top-4 right-4 z-20">
    <UserButton />
  </div>
)}
```

- [ ] **Step 10: Run type-check and fix any remaining errors**

Run: `pnpm --filter=web type-check`
Fix any import/prop mismatches.

- [ ] **Step 11: Run all tests**

Run: `pnpm --filter=web vitest run`
Expected: ALL PASS

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "refactor: update page.tsx — explicit proceed flow, remove auto-process, clean up fixed elements"
```

---

## Chunk 3: Export/Edit

### Task 9: Create useAudioTrimmer Hook

**Files:**
- Create: `apps/web/src/hooks/useAudioTrimmer.ts`
- Create: `apps/web/src/__tests__/useAudioTrimmer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/__tests__/useAudioTrimmer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioTrimmer } from '../hooks/useAudioTrimmer'
import type { Word } from '@ordio/shared/schemas'

describe('useAudioTrimmer', () => {
  const sampleRate = 44100

  it('initializes with full duration range and no deletions', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    expect(result.current.trimState.startTime).toBe(0)
    expect(result.current.trimState.endTime).toBe(10)
    expect(result.current.trimState.deletedWordIndices.size).toBe(0)
  })

  it('updates start and end times', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.setStartTime(2))
    act(() => result.current.setEndTime(8))
    expect(result.current.trimState.startTime).toBe(2)
    expect(result.current.trimState.endTime).toBe(8)
  })

  it('clamps start time to valid range', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.setStartTime(-1))
    expect(result.current.trimState.startTime).toBe(0)
    act(() => result.current.setStartTime(11))
    expect(result.current.trimState.startTime).toBe(10)
  })

  it('toggles word deletion', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.toggleWordDeletion(3))
    expect(result.current.trimState.deletedWordIndices.has(3)).toBe(true)
    act(() => result.current.toggleWordDeletion(3))
    expect(result.current.trimState.deletedWordIndices.has(3)).toBe(false)
  })

  it('clears all deletions', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.toggleWordDeletion(1))
    act(() => result.current.toggleWordDeletion(5))
    act(() => result.current.clearDeletions())
    expect(result.current.trimState.deletedWordIndices.size).toBe(0)
  })

  it('filters transcript by time range and deleted indices', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    const transcript: Word[] = [
      { text: 'hello', start: 0, end: 0.5 },
      { text: 'um', start: 1, end: 1.2 },
      { text: 'world', start: 2, end: 2.5 },
      { text: 'today', start: 9, end: 9.5 },
    ]

    act(() => {
      result.current.setStartTime(0.5)
      result.current.setEndTime(8)
      result.current.toggleWordDeletion(1) // delete "um"
    })

    const trimmed = result.current.getTrimmedTranscript(transcript)
    expect(trimmed.map((w) => w.text)).toEqual(['world'])
  })

  it('rebases timestamps after word deletion', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    const transcript: Word[] = [
      { text: 'hello', start: 0, end: 0.5 },
      { text: 'um', start: 1, end: 1.5 },
      { text: 'world', start: 2, end: 2.5 },
    ]

    act(() => result.current.toggleWordDeletion(1)) // delete "um" (0.5s duration)

    const trimmed = result.current.getTrimmedTranscript(transcript)
    // "world" should shift earlier by 0.5s (duration of "um")
    expect(trimmed[1].text).toBe('world')
    expect(trimmed[1].start).toBeCloseTo(1.5)
    expect(trimmed[1].end).toBeCloseTo(2.0)
  })

  it('reports hasChanges correctly', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    expect(result.current.hasChanges).toBe(false)
    act(() => result.current.setStartTime(1))
    expect(result.current.hasChanges).toBe(true)
  })

  it('reports isEmpty when all content is trimmed', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.setStartTime(10)) // start >= end
    expect(result.current.isEmpty).toBe(true)
  })

  it('clamps end time to valid range', () => {
    const { result } = renderHook(() => useAudioTrimmer(10))
    act(() => result.current.setEndTime(-1))
    expect(result.current.trimState.endTime).toBe(0)
    act(() => result.current.setEndTime(15))
    expect(result.current.trimState.endTime).toBe(10)
  })

  describe('getTrimmedAudio', () => {
    // Create a mock AudioBuffer for testing
    function createMockBuffer(samples: number, sampleRate = 44100): AudioBuffer {
      return {
        sampleRate,
        numberOfChannels: 1,
        length: samples,
        duration: samples / sampleRate,
        getChannelData: () => {
          const data = new Float32Array(samples)
          for (let i = 0; i < samples; i++) data[i] = i / samples
          return data
        },
      } as unknown as AudioBuffer
    }

    it('trims audio to start/end times', () => {
      const buffer = createMockBuffer(44100) // 1 second at 44100
      const { result } = renderHook(() => useAudioTrimmer(1))
      act(() => {
        result.current.setStartTime(0.25)
        result.current.setEndTime(0.75)
      })
      const channels = result.current.getTrimmedAudio(buffer, [])
      expect(channels).toHaveLength(1)
      // 0.5s of audio = 22050 samples
      expect(channels[0].length).toBe(Math.floor(0.75 * 44100) - Math.floor(0.25 * 44100))
    })

    it('splices out deleted word ranges', () => {
      const buffer = createMockBuffer(44100 * 3, 44100) // 3 seconds
      const transcript: Word[] = [
        { text: 'hello', start: 0, end: 1 },
        { text: 'um', start: 1, end: 1.5 },
        { text: 'world', start: 1.5, end: 3 },
      ]
      const { result } = renderHook(() => useAudioTrimmer(3))
      act(() => result.current.toggleWordDeletion(1)) // delete "um" (0.5s)
      const channels = result.current.getTrimmedAudio(buffer, transcript)
      // 3s total - 0.5s deleted = 2.5s = 110250 samples
      expect(channels[0].length).toBe(44100 * 3 - Math.floor(0.5 * 44100))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=web vitest run src/__tests__/useAudioTrimmer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useAudioTrimmer hook**

Create `apps/web/src/hooks/useAudioTrimmer.ts`:

```typescript
'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Word } from '@ordio/shared/schemas'

interface TrimState {
  startTime: number
  endTime: number
  deletedWordIndices: Set<number>
}

export interface UseAudioTrimmerReturn {
  trimState: TrimState
  setStartTime: (t: number) => void
  setEndTime: (t: number) => void
  toggleWordDeletion: (index: number) => void
  clearDeletions: () => void
  getTrimmedAudio: (audioBuffer: AudioBuffer, transcript: Word[]) => Float32Array[]
  getTrimmedTranscript: (transcript: Word[]) => Word[]
  hasChanges: boolean
  isEmpty: boolean
}

export function useAudioTrimmer(duration: number): UseAudioTrimmerReturn {
  const [startTime, setStartTimeRaw] = useState(0)
  const [endTime, setEndTimeRaw] = useState(duration)
  const [deletedWordIndices, setDeletedWordIndices] = useState<Set<number>>(
    () => new Set()
  )

  const setStartTime = useCallback(
    (t: number) => setStartTimeRaw(Math.max(0, Math.min(t, duration))),
    [duration]
  )

  const setEndTime = useCallback(
    (t: number) => setEndTimeRaw(Math.max(0, Math.min(t, duration))),
    [duration]
  )

  const toggleWordDeletion = useCallback((index: number) => {
    setDeletedWordIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const clearDeletions = useCallback(() => {
    setDeletedWordIndices(new Set())
  }, [])

  const getTrimmedTranscript = useCallback(
    (transcript: Word[]): Word[] => {
      // Filter by time range and deleted indices
      const kept = transcript.filter(
        (w, i) =>
          !deletedWordIndices.has(i) &&
          w.end > startTime &&
          w.start < endTime
      )

      // Compute cumulative deleted duration before each kept word
      // for timestamp rebasing
      let cumulativeDeleted = 0
      const deletedRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .sort((a, b) => a.start - b.start)

      return kept.map((word) => {
        // Sum durations of deleted words that came before this word
        const deletedBefore = deletedRanges
          .filter((d) => d.end <= word.start)
          .reduce((sum, d) => sum + (d.end - d.start), 0)

        // Also account for head trim
        const headTrim = startTime

        return {
          ...word,
          start: word.start - headTrim - deletedBefore,
          end: word.end - headTrim - deletedBefore,
        }
      })
    },
    [startTime, endTime, deletedWordIndices]
  )

  const getTrimmedAudio = useCallback(
    (audioBuffer: AudioBuffer, transcript: Word[]): Float32Array[] => {
      const { sampleRate, numberOfChannels } = audioBuffer
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)

      // Build sorted list of deleted word sample ranges
      const deletedSampleRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .sort((a, b) => a.start - b.start)
        .map((w) => ({
          start: Math.floor(w.start * sampleRate),
          end: Math.floor(w.end * sampleRate),
        }))

      // Build kept ranges: start with [startSample, endSample], punch out deleted ranges
      const keptRanges: Array<{ start: number; end: number }> = []
      let cursor = startSample
      for (const del of deletedSampleRanges) {
        // Skip deleted ranges outside our trim window
        if (del.end <= startSample || del.start >= endSample) continue
        const delStart = Math.max(del.start, startSample)
        const delEnd = Math.min(del.end, endSample)
        if (cursor < delStart) {
          keptRanges.push({ start: cursor, end: delStart })
        }
        cursor = delEnd
      }
      if (cursor < endSample) {
        keptRanges.push({ start: cursor, end: endSample })
      }

      // Concatenate kept ranges per channel
      const totalSamples = keptRanges.reduce((sum, r) => sum + (r.end - r.start), 0)
      const channels: Float32Array[] = []
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const source = audioBuffer.getChannelData(ch)
        const output = new Float32Array(totalSamples)
        let offset = 0
        for (const range of keptRanges) {
          const segment = source.subarray(range.start, range.end)
          output.set(segment, offset)
          offset += segment.length
        }
        channels.push(output)
      }
      return channels
    },
    [startTime, endTime, deletedWordIndices]
  )

  const trimState: TrimState = useMemo(
    () => ({ startTime, endTime, deletedWordIndices }),
    [startTime, endTime, deletedWordIndices]
  )

  const hasChanges = startTime > 0 || endTime < duration || deletedWordIndices.size > 0
  const isEmpty = startTime >= endTime

  // For "all words deleted" check, consumers should use:
  // trimmer.isEmpty || trimmer.trimState.deletedWordIndices.size >= transcript.length

  return {
    trimState,
    setStartTime,
    setEndTime,
    toggleWordDeletion,
    clearDeletions,
    getTrimmedAudio,
    getTrimmedTranscript,
    hasChanges,
    isEmpty,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=web vitest run src/__tests__/useAudioTrimmer.test.ts`
Expected: ALL PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useAudioTrimmer.ts apps/web/src/__tests__/useAudioTrimmer.test.ts
git commit -m "feat: add useAudioTrimmer hook — non-destructive trim with word-level deletion"
```

---

### Task 10: Create IconToolbar Component

**Files:**
- Create: `apps/web/src/components/primitives/IconToolbar.tsx`

- [ ] **Step 1: Create the IconToolbar component**

Create `apps/web/src/components/primitives/IconToolbar.tsx`:

```tsx
'use client'

import { cn } from '@/lib/cn'

export type ToolbarPanel = 'captions' | 'style' | 'format' | 'trim'

interface ToolbarItem {
  id: ToolbarPanel
  label: string
  icon: React.ReactNode
}

interface IconToolbarProps {
  activePanel: ToolbarPanel
  onPanelChange: (panel: ToolbarPanel) => void
}

const CaptionsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="4" width="16" height="10" rx="2" />
    <line x1="4" y1="8" x2="10" y2="8" strokeLinecap="round" />
    <line x1="4" y1="11" x2="14" y2="11" strokeLinecap="round" />
  </svg>
)

const StyleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="12" cy="7" r="2.5" />
    <circle cx="9" cy="13" r="2.5" />
  </svg>
)

const FormatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="12" height="12" rx="2" />
  </svg>
)

const TrimIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="5" r="2.5" />
    <circle cx="5" cy="13" r="2.5" />
    <line x1="7" y1="6" x2="16" y2="13" strokeLinecap="round" />
    <line x1="7" y1="12" x2="16" y2="5" strokeLinecap="round" />
  </svg>
)

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'captions', label: 'Captions', icon: <CaptionsIcon /> },
  { id: 'style', label: 'Style', icon: <StyleIcon /> },
  { id: 'format', label: 'Format', icon: <FormatIcon /> },
  { id: 'trim', label: 'Trim', icon: <TrimIcon /> },
]

export function IconToolbar({ activePanel, onPanelChange }: IconToolbarProps) {
  return (
    <div className="flex justify-around py-2 px-6">
      {TOOLBAR_ITEMS.map((item) => {
        const isActive = activePanel === item.id
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={isActive}
            className="flex flex-col items-center gap-1"
            onClick={() => onPanelChange(item.id)}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors',
                isActive
                  ? 'bg-[--surface-active] text-[--primary]'
                  : 'bg-[--surface] text-[--secondary]'
              )}
            >
              {item.icon}
            </div>
            <span
              className={cn(
                'text-[10px] transition-colors',
                isActive ? 'text-[--primary] font-medium' : 'text-[--secondary]'
              )}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/primitives/IconToolbar.tsx
git commit -m "feat: add IconToolbar component — CapCut-style panel switcher"
```

---

### Task 11: Create TrimPanel Component

**Files:**
- Create: `apps/web/src/components/soul/TrimPanel.tsx`

- [ ] **Step 1: Read waveformSampler from shared package**

Read: `packages/shared/src/waveform.ts`
Understand the `waveformSampler()` function signature — it returns downsampled amplitude data that we'll draw in the mini waveform.

- [ ] **Step 2: Create the TrimPanel component**

Create `apps/web/src/components/soul/TrimPanel.tsx`:

```tsx
'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { waveformSampler } from '@ordio/shared/waveform'
import type { Word } from '@ordio/shared/schemas'
import type { UseAudioTrimmerReturn } from '@/hooks/useAudioTrimmer'

interface TrimPanelProps {
  audioBuffer: AudioBuffer | null
  transcript: Word[]
  trimmer: UseAudioTrimmerReturn
  onSeek: (time: number) => void
}

export function TrimPanel({ audioBuffer, transcript, trimmer, onSeek }: TrimPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeHandle = useRef<'start' | 'end' | null>(null)

  const { trimState, setStartTime, setEndTime, toggleWordDeletion, clearDeletions } = trimmer
  const duration = audioBuffer?.duration ?? 0

  // Downsample audio for waveform visualization
  const bars = useMemo(() => {
    if (!audioBuffer) return []
    return waveformSampler(audioBuffer.getChannelData(0), 100)
  }, [audioBuffer])

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || bars.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Draw bars
    const barWidth = width / bars.length
    bars.forEach((amp, i) => {
      const barH = Math.max(1, amp * height * 0.8)
      const x = i * barWidth
      const y = (height - barH) / 2
      ctx.fillStyle = 'rgba(250, 248, 245, 0.4)'
      ctx.fillRect(x, y, barWidth - 1, barH)
    })

    // Darken trimmed regions
    const startX = (trimState.startTime / duration) * width
    const endX = (trimState.endTime / duration) * width

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, startX, height)
    ctx.fillRect(endX, 0, width - endX, height)
  }, [bars, trimState.startTime, trimState.endTime, duration])

  // Pointer handling for drag handles
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current || duration === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = x / rect.width

      const startPct = trimState.startTime / duration
      const endPct = trimState.endTime / duration

      // Determine which handle is closer
      if (Math.abs(pct - startPct) < Math.abs(pct - endPct)) {
        activeHandle.current = 'start'
      } else {
        activeHandle.current = 'end'
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [trimState.startTime, trimState.endTime, duration]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle.current || !containerRef.current || duration === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const time = pct * duration

      if (activeHandle.current === 'start') {
        setStartTime(Math.min(time, trimState.endTime - 0.1))
      } else {
        setEndTime(Math.max(time, trimState.startTime + 0.1))
      }
    },
    [duration, trimState.startTime, trimState.endTime, setStartTime, setEndTime]
  )

  const handlePointerUp = useCallback(() => {
    activeHandle.current = null
  }, [])

  const selectedCount = trimState.deletedWordIndices.size

  const formatTimestamp = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Timeline trim */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-[--secondary]">Timeline</span>
          <span className="text-[10px] text-[--tertiary]">Drag handles to trim start/end</span>
        </div>

        <div
          ref={containerRef}
          className="relative h-12 bg-[--surface] rounded-lg cursor-ew-resize touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={48}
            className="w-full h-full rounded-lg"
          />

          {/* Start handle */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-[--primary] rounded-sm cursor-ew-resize"
            style={{ left: `${(trimState.startTime / duration) * 100}%` }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>

          {/* End handle */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-[--primary] rounded-sm cursor-ew-resize"
            style={{ left: `${(trimState.endTime / duration) * 100}%`, transform: 'translateX(-100%)' }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[--tertiary] font-mono">
            {formatTimestamp(trimState.startTime)}
          </span>
          <span className="text-[10px] text-[--tertiary] font-mono">
            {formatTimestamp(trimState.endTime)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[--border]" />

      {/* Section 2: Word removal */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-[--secondary]">Remove words</span>
          <span className="text-[10px] text-[--tertiary]">Tap words to select</span>
        </div>

        {/* Word chips */}
        <div className="flex flex-wrap gap-1.5">
          {transcript.map((word, i) => {
            const isDeleted = trimState.deletedWordIndices.has(i)
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs transition-colors',
                  isDeleted
                    ? 'bg-[rgba(225,29,72,0.12)] border border-[rgba(225,29,72,0.3)] text-destructive line-through opacity-50'
                    : 'bg-[--surface] text-[--secondary] hover:bg-[--surface-hover]'
                )}
                onClick={() => toggleWordDeletion(i)}
              >
                {word.text}
              </button>
            )
          })}
        </div>

        {/* Action bar (visible when words are selected) */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[--border]">
            <span className="text-xs text-destructive/60">
              {selectedCount} word{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-[--secondary] hover:text-[--primary] transition-colors"
                onClick={clearDeletions}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs text-destructive bg-[rgba(225,29,72,0.12)] px-3 py-1 rounded-md hover:bg-[rgba(225,29,72,0.2)] transition-colors"
                onClick={() => {
                  // Deletion is already toggled — "Remove" confirms by keeping current state
                  // Words in deletedWordIndices will be excluded at export time
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/soul/TrimPanel.tsx
git commit -m "feat: add TrimPanel — timeline drag handles + text-based word deletion"
```

---

### Task 12: Rewrite ExportState

**Files:**
- Modify: `apps/web/src/components/soul/ExportState.tsx`
- Modify: `apps/web/src/components/soul/StyleControls.tsx`
- Modify: `apps/web/src/components/soul/FormatToggle.tsx`
- Modify: `apps/web/src/components/primitives/PlaybackControls.tsx`

- [ ] **Step 1: Read current ExportState, StyleControls, FormatToggle, PlaybackControls**

Read all 4 files to understand current props and structure.

- [ ] **Step 2: Simplify PlaybackControls**

Remove the play/pause button from `PlaybackControls` — it moves to the preview overlay. Keep only the scrubber (timeline track + knob + timestamps). Update the component to accept and render with the new monochrome tokens.

- [ ] **Step 3: Remove collapsible wrapper from StyleControls**

`StyleControls.tsx` currently wraps content in a collapsible accordion (expand/collapse with chevron). Remove this wrapper — the content is now shown in a flat panel. Keep the color pickers, font selector, and font size slider. Add the note about caption position being in recording settings.

- [ ] **Step 4: Add LockBadge to FormatToggle locked options**

The current `FormatToggle` already has feature gates (lines 19-23) but the spec requires explicit `LockBadge` rendering. Verify lock badges are present, and update styling to use `--surface-active` for the selected format.

- [ ] **Step 5: Rewrite ExportState with icon toolbar layout**

Replace the vertically stacked layout with:

```tsx
export function ExportState({ ... }: ExportStateProps) {
  const [activePanel, setActivePanel] = useState<ToolbarPanel>('captions')
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  return (
    <div className="flex flex-col items-center max-w-[480px] mx-auto animate-fadeIn">
      {/* Top nav bar */}
      <div className="flex items-center justify-between w-full px-4 py-3">
        <button
          aria-label="Back to home"
          onClick={() => setShowDiscardDialog(true)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 4L6 10L12 16" />
          </svg>
        </button>
        <span className="text-[13px] font-medium text-[--primary]">Edit</span>
        <div className="flex items-center gap-3">
          <UserButton />
          <button
            className="text-[13px] font-semibold text-[--primary] disabled:opacity-40"
            onClick={onExport}
            disabled={exporter.isExporting || trimmer.isEmpty || trimmer.trimState.deletedWordIndices.size >= transcript.length}
          >
            Export
          </button>
        </div>
      </div>

      {/* Discard confirmation dialog */}
      {showDiscardDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowDiscardDialog(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] rounded-2xl p-6 w-[280px] text-center border border-[--border]">
            <p className="text-[--primary] text-sm font-medium mb-1">Discard changes and start over?</p>
            <p className="text-[--tertiary] text-xs mb-5">Your edits will be lost.</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-lg text-sm text-[--secondary] bg-[--surface]"
                onClick={() => setShowDiscardDialog(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-lg text-sm text-destructive bg-[rgba(225,29,72,0.12)]"
                onClick={onReset}
              >
                Discard
              </button>
            </div>
          </div>
        </>
      )}

      {/* Canvas preview with play overlay + format badge */}
      <div className="relative px-4 w-full">
        <CanvasPreview ... />

        {/* Format badge top-right */}
        <div className="absolute top-2 right-6 px-2 py-0.5 rounded bg-[--surface] text-[--secondary] text-[10px] font-mono">
          {formatLabel}
        </div>

        {/* Play/pause overlay button */}
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={playback.isPlaying ? playback.pause : playback.play}
          aria-label={playback.isPlaying ? 'Pause preview' : 'Play preview'}
        >
          <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-[8px] flex items-center justify-center">
            {playback.isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-white">
                <rect x="3" y="2" width="3.5" height="12" rx="1" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-white ml-0.5">
                <polygon points="3,1 14,8 3,15" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Scrubber */}
      <PlaybackControls ... />

      {/* Icon toolbar */}
      <IconToolbar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Active panel */}
      <div className="w-full border-t border-[--border] px-4 py-3">
        {activePanel === 'captions' && <CaptionEditor ... />}
        {activePanel === 'style' && <StyleControls ... />}
        {activePanel === 'format' && <FormatToggle ... />}
        {activePanel === 'trim' && <TrimPanel ... />}
      </div>

      {/* Trim empty warning — handles overlap OR all words deleted */}
      {(trimmer.isEmpty || trimmer.trimState.deletedWordIndices.size >= transcript.length) && (
        <p className="text-destructive text-xs mt-2 px-4">No audio remaining</p>
      )}

      {/* Export progress (shown when exporting) */}
      {exporter.isExporting && (
        <div className="w-full px-4 mt-4">
          <div
            className="h-1 bg-[--surface] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round((exporter.exportProgress ?? 0) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Export progress"
          >
            <div
              className="h-full bg-[--primary] transition-all duration-150 rounded-full"
              style={{ width: `${(exporter.exportProgress ?? 0) * 100}%` }}
            />
          </div>
          <p className="text-center text-[--secondary] text-xs mt-2">
            {Math.round((exporter.exportProgress ?? 0) * 100)}%
          </p>
        </div>
      )}

      {/* Error toast handled by Sonner — no inline error display */}

      {/* Post-export: Download button */}
      {exporter.exportedUrl && (
        <button className={primaryBtn()} onClick={onDownload}>
          Download
        </button>
      )}
    </div>
  )
}
```

The above is structural guidance — the actual implementation should follow the existing code patterns (CVA variants, cn() for class merging, proper prop types).

- [ ] **Step 6: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS (fix any remaining type errors)

- [ ] **Step 7: Run all tests**

Run: `pnpm --filter=web vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/soul/ExportState.tsx apps/web/src/components/soul/StyleControls.tsx apps/web/src/components/soul/FormatToggle.tsx apps/web/src/components/primitives/PlaybackControls.tsx
git commit -m "feat: rewrite ExportState — icon toolbar layout with panel switching"
```

---

### Task 13: Update CaptionEditor for Trim Mode

**Files:**
- Modify: `apps/web/src/components/soul/CaptionEditor.tsx`

- [ ] **Step 1: Read current CaptionEditor.tsx and update props interface**

Read: `apps/web/src/components/soul/CaptionEditor.tsx`
Understand the current word chip rendering, click-to-seek, and double-click-to-edit behavior.

Add the new props to the `CaptionEditorProps` interface:

```typescript
interface CaptionEditorProps {
  currentTime: number
  onSeek: (time: number) => void
  isTranscribing?: boolean
  trimmer?: UseAudioTrimmerReturn  // import from '@/hooks/useAudioTrimmer'
}
```

Also **remove the existing empty state** at the bottom of the component (currently around lines 139-148, which shows "No transcript yet" in a `panelCard`). The new early-return checks below replace it.

- [ ] **Step 2: Add empty and loading states**

Add at the top of the component render (before any existing JSX):

```tsx
// Loading state
if (isTranscribing) {
  return (
    <div className="py-6 text-center">
      <p className="text-[--secondary] text-sm">Transcribing...</p>
    </div>
  )
}

// Empty state
if (!transcript || transcript.length === 0) {
  return (
    <div className="py-6 text-center">
      <p className="text-[--secondary] text-sm">No captions available</p>
      <p className="text-[--tertiary] text-xs mt-1">Check microphone permissions or try again</p>
    </div>
  )
}
```

- [ ] **Step 3: Add trim mode visual state to word chips**

If the CaptionEditor receives a `trimmer` prop, word chips should show trim-related visual states:
- Words in `trimmer.trimState.deletedWordIndices` get: red background + strikethrough + muted opacity
- This is purely visual — the actual deletion toggle happens in TrimPanel

```tsx
const isDeleted = trimmer?.trimState.deletedWordIndices.has(index) ?? false

<span
  className={cn(
    'px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
    isDeleted
      ? 'bg-[rgba(225,29,72,0.12)] border border-[rgba(225,29,72,0.3)] text-destructive line-through opacity-50'
      : isActive
        ? 'bg-[--surface-active] border border-[--border-active] text-[--primary]'
        : 'bg-[--surface] text-[--secondary]'
  )}
>
```

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `pnpm --filter=web vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/CaptionEditor.tsx
git commit -m "feat: add empty/loading states and trim-mode visuals to CaptionEditor"
```

---

### Task 14: Wire Trim into Export Pipeline

**Files:**
- Modify: `apps/web/src/components/soul/ExportState.tsx`
- Modify: `apps/web/src/app/page.tsx` (if export handler lives here)

The `useAudioTrimmer` hook produces trimmed audio and transcript, but nothing currently connects it to the export pipeline. This task wires them together.

- [ ] **Step 1: Initialize useAudioTrimmer in ExportState**

In `ExportState.tsx`, add the trimmer hook:

```typescript
const trimmer = useAudioTrimmer(audioBuffer?.duration ?? 0)
```

Pass `trimmer` to `TrimPanel` and `CaptionEditor` as props.

- [ ] **Step 2: Wire trimmed data into export handler**

Update the `onExport` handler (or `startExport` call) to apply trimming before export:

```typescript
const handleExport = useCallback(() => {
  if (!audioBuffer || !transcript) return
  const trimmedAudio = trimmer.getTrimmedAudio(audioBuffer, transcript)
  const trimmedTranscript = trimmer.getTrimmedTranscript(transcript)
  // Pass trimmedAudio and trimmedTranscript to startExport
  startExport({ audioChannels: trimmedAudio, transcript: trimmedTranscript, ... })
}, [audioBuffer, transcript, trimmer, startExport])
```

The exact integration depends on `useVideoExporter`'s `startExport` signature — read it first and adapt the call.

- [ ] **Step 3: Compute format label for badge**

Add a `formatLabel` map for the format badge in the canvas preview:

```typescript
const FORMAT_LABELS: Record<string, string> = {
  square: '1:1',
  vertical: '9:16',
  horizontal: '16:9',
  instagram: '4:5',
}
const formatLabel = FORMAT_LABELS[format] ?? '1:1'
```

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/ExportState.tsx apps/web/src/app/page.tsx
git commit -m "feat: wire useAudioTrimmer into export pipeline"
```

---

### Task 15: Final Integration and Smoke Test

**Files:**
- All modified files

- [ ] **Step 1: Run full type-check**

Run: `pnpm --filter=web type-check`
Expected: PASS — zero type errors

- [ ] **Step 2: Run all tests**

Run: `pnpm --filter=web vitest run`
Expected: ALL PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Run dev server and manually verify**

Run: `pnpm dev --filter=web`

Manually verify:
1. **Idle state:** Dormant orb visible, breathing slowly (±0.02 scale, 6s cycle). Tap orb → recording starts.
2. **Recording state:** Orb brightens and reacts to voice. Pause dims orb to 70%. Settings gear opens sheet with focus trap. Stop → checkpoint with Proceed/Resume/Restart.
3. **Processing state:** Progress ring + step list (unchanged).
4. **Export state:** Icon toolbar with 4 panels. Each panel renders correctly. Trim panel shows waveform handles + word chips. Back arrow shows discard confirmation dialog.
5. **Export progress bar:** Warm off-white `--primary` fill, no gradient. Has `role="progressbar"` ARIA attrs.
6. **Format badge:** Shows correct ratio (1:1, 9:16, etc.) top-right of canvas preview.
7. **Trim empty state:** Delete all words → Export button disabled, "No audio remaining" shown.
8. **Design system:** No purple/blue accent colors in chrome. Warm off-white (`#FAF8F5`) throughout.
9. **Pointer events:** Trim handles work on touch devices (use mobile simulator).

- [ ] **Step 5: Commit integration fixes if needed**

```bash
git add apps/web/src/components/ apps/web/src/hooks/ apps/web/src/app/ apps/web/src/lib/
git commit -m "chore: integration fixes for UI/UX redesign"
```
