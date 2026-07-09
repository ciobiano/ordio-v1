# Sheet Consistency + CaptureSidebar Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the undefined `--glass-bg` CSS token (7 dead usages), remove unconsumed glass-material tokens left over from a superseded March redesign, unify all bottom sheets on one solid-dark background + shape, and upgrade `CaptureSidebar` with a removed blue button, edge-swipe open/close, and swipe-to-delete per recording row.

**Architecture:** Phase 1 (Tasks 1-5) is a mechanical token/styling sweep — one new `--sheet-bg` CSS custom property replaces both the broken `--glass-bg` and scattered `#0d0d10` hex literals, consumed via a shared `captureSheetSurface` variants.ts constant for shape (radius/shadow/inset). Phase 2 (Tasks 6-10) upgrades the live `CaptureSidebar.tsx`: a new pure `sidebarReveal.ts` module computes the drag-reveal distance (unit tested in isolation), `framer-motion`'s `useDragControls` wires an edge-swipe gesture into `CaptureScreen.tsx`, and `CaptureSidebar.tsx` gains per-row swipe-to-delete backed by the existing `api.sessions.deleteSession` Convex mutation. Dead code (`SavedAudioPanel.tsx`, `SavedAudioDialogs.tsx`) is deleted last, after nothing depends on it.

**Tech Stack:** Next.js 15 / React 19, Tailwind CSS 4 (arbitrary-value CSS custom properties, no `@theme inline` registration needed), `framer-motion` 12 (`drag`, `useDragControls`, `PanInfo`), Convex (`useMutation`, `usePaginatedQuery`), Vitest + `@testing-library/react` + `jsdom`.

## Global Constraints

- Never use inline style props for styling — CVA (`variants.ts`) + Tailwind classes only (per project CLAUDE.md). Exception: numeric/computed values framer-motion requires via its own `style`/`animate` props are not Tailwind-expressible and are not "inline style props" in the CVA sense.
- Never use raw `<img>` — not applicable in this plan (no new images).
- No `Co-Authored-By: Claude` in any commit.
- Batch tests once per task (this repo's existing convention: `pnpm --filter web exec vitest run <file>` per task, full `pnpm --filter web exec tsc --noEmit` at the end of each phase).
- Commit after each task with a conventional commit message; do not push (push requires separate explicit approval).

---

### Task 1: Remove dead glass-material tokens, add `--sheet-bg`

**Files:**
- Modify: `apps/web/src/app/globals.css:229-236`

**Interfaces:**
- Produces: CSS custom property `--sheet-bg` (value `#0d0d10`), consumed by every later task in this plan via `bg-[color:var(--sheet-bg)]`.

- [ ] **Step 1: Remove the 5 dead tokens and add `--sheet-bg`**

Current (`globals.css:229-236`):
```css
  --accent-red: #e11d48;
  --surface-sheet: rgba(255, 255, 255, 0.03);
  --accent-green: #3fb950;
  --surface-glass: rgba(18, 18, 20, 0.72);
  --surface-glass-card: rgba(18, 18, 20, 0.78);
  --border-glass: rgba(255, 255, 255, 0.16);
  --shadow-glass-top: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  --surface-selected: rgba(255, 255, 255, 0.2);
```

Replace with:
```css
  --accent-red: #e11d48;
  --surface-sheet: rgba(255, 255, 255, 0.03);
  --accent-green: #3fb950;
  --sheet-bg: #0d0d10; /* single source of truth for sheet/drawer/sidebar dark surfaces */
```

- [ ] **Step 2: Verify no remaining references to the removed tokens**

Run: `grep -rn "surface-glass\|border-glass\|shadow-glass-top\|surface-selected" apps/web/src`
Expected: no output (these were already confirmed unconsumed by any component before writing this plan)

- [ ] **Step 3: Verify the build still type-checks**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(design): remove dead glass-material tokens, add --sheet-bg"
```

---

### Task 2: Add `captureSheetSurface` variant, repoint `RecordingSettingsSheet`

**Files:**
- Modify: `apps/web/src/lib/variants.ts` (add new export near `panelCard`, line 173)
- Modify: `apps/web/src/components/soul/recording/RecordingSettingsSheet.tsx:128,133,253`

**Interfaces:**
- Consumes: `--sheet-bg` (Task 1)
- Produces: `captureSheetSurface` string constant from `@/lib/variants`, consumed by Tasks 3 and 4 (`UpgradeSheet`, `ExportControls`)

- [ ] **Step 1: Add the shared sheet-shape constant**

In `apps/web/src/lib/variants.ts`, add directly above `export const panelCard = ...` (line 173):

```ts
/**
 * Shared silhouette for all bottom sheets/drawers — solid dark bg, floating
 * inset, large radius, drop shadow. One definition so RecordingSettingsSheet,
 * UpgradeSheet, and the ExportControls mobile drawer share one shape.
 */
export const captureSheetSurface =
  'bg-[color:var(--sheet-bg)] rounded-4xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] ' +
  'data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-2.5 ' +
  'data-[vaul-drawer-direction=bottom]:right-2.5 data-[vaul-drawer-direction=bottom]:bottom-3.5';
```

- [ ] **Step 2: Repoint `RecordingSettingsSheet` onto the shared constant**

In `apps/web/src/components/soul/recording/RecordingSettingsSheet.tsx`, add the import (top of file, alongside the existing `cn` import):
```ts
import { captureSheetSurface } from '@/lib/variants';
```

Replace line 128:
```tsx
        className="bg-[#0d0d10] p-0 flex flex-col max-h-[50vh] rounded-4xl overflow-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-2.5 data-[vaul-drawer-direction=bottom]:right-2.5 data-[vaul-drawer-direction=bottom]:bottom-3.5 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px]"
```
with:
```tsx
        className={cn(captureSheetSurface, 'p-0 flex flex-col max-h-[50vh] overflow-hidden sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px]')}
```

Replace line 133:
```tsx
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[#0d0d10]">
```
with:
```tsx
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[color:var(--sheet-bg)]">
```

Replace line 253:
```tsx
                          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(18,18,20)]" />
```
with:
```tsx
                          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--sheet-bg)]" />
```

- [ ] **Step 3: Verify the type-check and existing capture tests still pass**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec vitest run capture-phase`
Expected: both clean/passing (no behavior changed, styling only)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/variants.ts apps/web/src/components/soul/recording/RecordingSettingsSheet.tsx
git commit -m "refactor(design): add captureSheetSurface variant, repoint RecordingSettingsSheet"
```

---

### Task 3: Repoint `UpgradeSheet` onto `captureSheetSurface`

**Files:**
- Modify: `apps/web/src/components/soul/modals/UpgradeSheet.tsx:54`

**Interfaces:**
- Consumes: `captureSheetSurface` from `@/lib/variants` (Task 2)

- [ ] **Step 1: Replace the broken glass background with the shared sheet shape**

Add import (top of file):
```ts
import { captureSheetSurface } from '@/lib/variants'
```

Replace line 54:
```tsx
        className="bg-[color:var(--glass-bg)] backdrop-blur-xl border-t border-white/[0.08] p-0 max-h-[85vh]"
```
with:
```tsx
        className={cn(captureSheetSurface, 'p-0 max-h-[85vh]')}
```

(`cn` is already imported in this file.)

- [ ] **Step 2: Verify no remaining `--glass-bg` reference in this file**

Run: `grep -n "glass-bg" apps/web/src/components/soul/modals/UpgradeSheet.tsx`
Expected: no output

- [ ] **Step 3: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/soul/modals/UpgradeSheet.tsx
git commit -m "fix(design): repoint UpgradeSheet onto captureSheetSurface, drop broken --glass-bg"
```

---

### Task 4: Repoint `ExportControls` mobile drawer onto `captureSheetSurface`

**Files:**
- Modify: `apps/web/src/components/soul/states/ExportState/ExportControls.tsx:108`

**Interfaces:**
- Consumes: `captureSheetSurface` from `@/lib/variants` (Task 2)

- [ ] **Step 1: Replace the broken glass background with the shared sheet shape**

Add import (top of file, alongside the existing `panelCard` import):
```ts
import { panelCard, captureSheetSurface } from '@/lib/variants'
```

Replace line 108:
```tsx
          className="md:hidden p-0 bg-[color:var(--glass-bg)] backdrop-blur-xl border-t border-white/[0.08]"
```
with:
```tsx
          className={cn(captureSheetSurface, 'md:hidden p-0')}
```

- [ ] **Step 2: Verify no remaining `--glass-bg` reference in this file**

Run: `grep -n "glass-bg" apps/web/src/components/soul/states/ExportState/ExportControls.tsx`
Expected: no output

- [ ] **Step 3: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/soul/states/ExportState/ExportControls.tsx
git commit -m "fix(design): repoint ExportControls mobile drawer onto captureSheetSurface"
```

---

### Task 5: Repoint remaining `--glass-bg` usages (`Dock`, `ExportFooter`, `StageControlBar`)

**Files:**
- Modify: `apps/web/src/components/ui/Dock.tsx:25`
- Modify: `apps/web/src/components/soul/states/ExportState/ExportFooter.tsx:57`
- Modify: `apps/web/src/components/soul/states/ExportState/StageControlBar.tsx:89,182,210`

**Interfaces:**
- Consumes: `--sheet-bg` (Task 1). These three files render flat surfaces (a bottom nav bar and two popover/select menus), not floating sheets, so they get the background token only — not the `captureSheetSurface` shape (which includes sheet-specific radius/inset/shadow that don't apply here).

- [ ] **Step 1: Repoint `Dock.tsx`**

Replace line 25:
```tsx
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[color:var(--glass-bg)] backdrop-blur-xl pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
```
with:
```tsx
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[color:var(--sheet-bg)] pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
```

- [ ] **Step 2: Repoint `ExportFooter.tsx`**

Replace line 57:
```tsx
          <div className="bg-[color:var(--glass-bg)] backdrop-blur-xl rounded-2xl px-4 py-3">
```
with:
```tsx
          <div className="bg-[color:var(--sheet-bg)] rounded-2xl px-4 py-3">
```

- [ ] **Step 3: Repoint `StageControlBar.tsx` (both `SelectContent` + the `PopoverContent`)**

Replace line 89:
```tsx
          className="w-[14rem] border-white/8 bg-[color:var(--glass-bg)] p-2 backdrop-blur-xl"
```
with:
```tsx
          className="w-[14rem] border-white/8 bg-[color:var(--sheet-bg)] p-2"
```

Replace line 182:
```tsx
        <SelectContent side="top" className="border-white/8 bg-[color:var(--glass-bg)] backdrop-blur-xl">
```
with:
```tsx
        <SelectContent side="top" className="border-white/8 bg-[color:var(--sheet-bg)]">
```

Replace line 210:
```tsx
        <SelectContent side="top" className="border-white/8 bg-[color:var(--glass-bg)] backdrop-blur-xl">
```
with:
```tsx
        <SelectContent side="top" className="border-white/8 bg-[color:var(--sheet-bg)]">
```

- [ ] **Step 4: Verify zero remaining `--glass-bg` references anywhere in the app**

Run: `grep -rn "glass-bg" apps/web/src`
Expected: no output

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit (end of Phase 1)**

```bash
git add apps/web/src/components/ui/Dock.tsx apps/web/src/components/soul/states/ExportState/ExportFooter.tsx apps/web/src/components/soul/states/ExportState/StageControlBar.tsx
git commit -m "fix(design): repoint Dock, ExportFooter, StageControlBar off broken --glass-bg"
```

---

### Task 6: Remove the blue "New recording" button from `CaptureSidebar`

**Files:**
- Modify: `apps/web/src/components/soul/capture/CaptureSidebar.tsx:106-124`
- Test: `apps/web/src/__tests__/CaptureSidebar.test.tsx` (new)

**Interfaces:**
- Produces: the shared Convex/Next mocks in this test file are reused and extended by Task 9.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/CaptureSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureSidebar } from '@/components/soul/capture/CaptureSidebar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [
      { id: 'session_1', name: 'Morning thoughts', createdAt: Date.now(), durationMs: 65000 },
    ],
  }),
  useMutation: () => vi.fn(),
}));

vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: {
      listMySessionsPaginated: 'sessions:listMySessionsPaginated',
      deleteSession: 'sessions:deleteSession',
    },
  },
}));

describe('CaptureSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render a "New recording" button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('New recording')).not.toBeInTheDocument();
  });

  it('still renders the Settings button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run CaptureSidebar`
Expected: FAIL — "does not render a \"New recording\" button" fails because the button is still present

- [ ] **Step 3: Remove the button**

In `apps/web/src/components/soul/capture/CaptureSidebar.tsx`, replace lines 106-124:
```tsx
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-t border-white/8">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-[#3a7bf0] text-white text-base font-semibold border-none cursor-pointer"
        >
          <Plus size={16} />
          New recording
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className={captureGlossyBtn}
          style={{ width: 44, height: 44 }}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
```
with:
```tsx
      <div className="flex items-center justify-end px-4 py-3.5 border-t border-white/8">
        <button
          type="button"
          onClick={onOpenSettings}
          className={captureGlossyBtn}
          style={{ width: 44, height: 44 }}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
```

`Plus` is still used elsewhere in this file (the "Upload audio or video" row, line 81) — do not remove its import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run CaptureSidebar`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/capture/CaptureSidebar.tsx apps/web/src/__tests__/CaptureSidebar.test.tsx
git commit -m "fix(capture): remove blue New recording button from CaptureSidebar"
```

---

### Task 7: Extract and test `computeSidebarRevealPx`

**Files:**
- Create: `apps/web/src/components/soul/capture/sidebarReveal.ts`
- Test: `apps/web/src/__tests__/sidebarReveal.test.ts` (new)

**Interfaces:**
- Produces: `SIDEBAR_REVEAL_RATIO: number` and `computeSidebarRevealPx(containerWidthPx: number): number`, consumed by Task 8 (`CaptureScreen.tsx`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/sidebarReveal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSidebarRevealPx, SIDEBAR_REVEAL_RATIO } from '@/components/soul/capture/sidebarReveal';

describe('computeSidebarRevealPx', () => {
  it('computes the reveal distance as a rounded percentage of container width', () => {
    expect(computeSidebarRevealPx(440)).toBe(326); // 440 * 0.74 = 325.6 -> 326
  });

  it('returns 0 for a zero-width container', () => {
    expect(computeSidebarRevealPx(0)).toBe(0);
  });

  it('matches SIDEBAR_REVEAL_RATIO exactly for any width', () => {
    expect(computeSidebarRevealPx(1000)).toBe(Math.round(1000 * SIDEBAR_REVEAL_RATIO));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run sidebarReveal`
Expected: FAIL with "Failed to resolve import" or "does not provide an export named 'computeSidebarRevealPx'"

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/soul/capture/sidebarReveal.ts`:

```ts
/**
 * The sidebar reveal (CaptureScreen's foreground page sliding right to
 * expose CaptureSidebar behind it) has always animated by a percentage of
 * the container width ('74%'), which auto-scales across device sizes.
 * framer-motion's drag constraints require a pixel value, so this converts
 * a measured container width into that same percentage in pixels.
 */
export const SIDEBAR_REVEAL_RATIO = 0.74;

export function computeSidebarRevealPx(containerWidthPx: number): number {
  return Math.round(containerWidthPx * SIDEBAR_REVEAL_RATIO);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run sidebarReveal`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/capture/sidebarReveal.ts apps/web/src/__tests__/sidebarReveal.test.ts
git commit -m "feat(capture): add computeSidebarRevealPx for drag-based sidebar reveal"
```

---

### Task 8: Wire edge-swipe open/close into `CaptureScreen`

**Files:**
- Modify: `apps/web/src/components/soul/capture/CaptureScreen.tsx`
- Test: `apps/web/src/__tests__/CaptureScreen.test.tsx` (new)

**Interfaces:**
- Consumes: `computeSidebarRevealPx` from `@/components/soul/capture/sidebarReveal` (Task 7)

**Note on test scope:** `framer-motion`'s drag gesture relies on real pointer-capture APIs (`PointerEvent.setPointerCapture`) that `jsdom` does not implement, so the physical drag itself is not practical to assert in a unit test — that part needs manual/device verification (Step 6 below). What *is* unit-testable and matters just as much: the edge-hitbox only exists while the sidebar is closed, and the close-overlay (which now also starts a drag) only exists while it's open. Those are the two structural facts the rest of this feature depends on.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/CaptureScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureScreen } from '@/components/soul/capture/CaptureScreen';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

const baseProps = {
  currentState: 'idle' as const,
  audioLevel: 0,
  isSpeaking: false,
  isStarting: false,
  micDenied: false,
  canRecord: true,
  processingProgress: 0,
  fileInputRef: { current: null },
  onFileUpload: vi.fn(),
  isPaused: false,
  onStartRecording: vi.fn(),
  onPauseRecording: vi.fn(),
  onResumeRecording: vi.fn(),
  onStopRecording: vi.fn(),
  onRestart: vi.fn(),
  onProceed: vi.fn(),
  onCancel: vi.fn(),
  onLocked: vi.fn(),
};

describe('CaptureScreen sidebar swipe zones', () => {
  it('renders the left-edge swipe hitbox when the sidebar is closed', () => {
    render(<CaptureScreen {...baseProps} />);
    expect(screen.getByLabelText('Open recordings by swiping')).toBeInTheDocument();
    expect(screen.queryByLabelText('Close recordings')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run CaptureScreen`
Expected: FAIL — no element with label "Open recordings by swiping" exists yet

- [ ] **Step 3: Implement the edge-swipe gesture**

In `apps/web/src/components/soul/capture/CaptureScreen.tsx`, update the imports at the top:
```tsx
import dynamic from 'next/dynamic';
import { motion, useDragControls } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import type { FeatureKey } from '@/lib/featureGates';
import { CaptureHeader } from './CaptureHeader';
import { CaptureStage } from './CaptureStage';
import { CaptureDock } from './CaptureDock';
import { CaptureSidebar } from './CaptureSidebar';
import { UploadActionSheet } from './UploadActionSheet';
import { deriveCapturePhase } from './phase';
import { computeSidebarRevealPx } from './sidebarReveal';
import type { RecordingSubPhase } from './types';
```

Add a fallback width constant next to `EASE`:
```tsx
const EASE = [0.32, 0.72, 0, 1] as const;
const FALLBACK_CONTAINER_PX = 440; // matches the outer container's max-w-[440px]
```

Inside the component, after the existing `pressActiveRef`/`pressStartRef` declarations, add:
```tsx
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [revealPx, setRevealPx] = useState(() => computeSidebarRevealPx(FALLBACK_CONTAINER_PX));

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateRevealPx = () => setRevealPx(computeSidebarRevealPx(node.offsetWidth));
    updateRevealPx();
    const observer = new ResizeObserver(updateRevealPx);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleSidebarDragEnd = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const draggedTo = (filesOpen ? revealPx : 0) + info.offset.x;
      setFilesOpen(draggedTo > revealPx / 2);
    },
    [filesOpen, revealPx]
  );
```

Replace the outer container's opening tag:
```tsx
    <div
      className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto overflow-hidden select-none"
      style={{ perspective: '1400px' }}
    >
```
with:
```tsx
    <div
      ref={containerRef}
      className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto overflow-hidden select-none"
      style={{ perspective: '1400px' }}
    >
```

Add the edge-swipe hitbox as a sibling right after the sidebar's wrapping div and before the `motion.div`. This also repoints that wrapping div's background from the hardcoded `#0d0d10` to the `--sheet-bg` token, completing the Phase 1 token sweep for this file:
```tsx
      <div className="absolute inset-0 z-1 bg-[color:var(--sheet-bg)]">
        <CaptureSidebar
          onOpenUpload={() => setUploadOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={closeFiles}
        />
      </div>

      {!filesOpen && (
        <div
          role="button"
          aria-label="Open recordings by swiping"
          className="absolute left-0 top-0 bottom-0 z-3 w-6"
          onPointerDown={(e) => dragControls.start(e)}
        />
      )}

      <motion.div
        className="absolute inset-0 z-2 bg-black text-white overflow-hidden"
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: revealPx }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleSidebarDragEnd}
        animate={{ x: filesOpen ? revealPx : 0 }}
        transition={{ duration: 0.44, ease: EASE }}
        style={{
          borderTopLeftRadius: filesOpen ? 44 : 0,
          borderBottomLeftRadius: filesOpen ? 44 : 0,
          boxShadow: filesOpen ? '-18px 0 40px rgba(0,0,0,.55)' : 'none',
        }}
      >
        {filesOpen && (
          <button
            type="button"
            aria-label="Close recordings"
            onClick={closeFiles}
            onPointerDown={(e) => dragControls.start(e)}
            className="absolute inset-0 z-100 border-none bg-transparent cursor-default"
          />
        )}
```

(The rest of the `motion.div`'s children — `CaptureHeader`, `CaptureStage`, `CaptureDock`, etc. — are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run CaptureScreen`
Expected: PASS

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 6: Manual verification (drag physics — not covered by jsdom)**

Run the app (`pnpm --filter web dev`), open `/create` on a touch device or Chrome DevTools device emulation, and confirm:
- Swiping right starting within ~24px of the left screen edge opens the sidebar
- Once open, swiping left anywhere on the visible page closes it
- Tapping the hamburger icon still opens it; tapping outside (the existing close overlay) still closes it

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/soul/capture/CaptureScreen.tsx apps/web/src/__tests__/CaptureScreen.test.tsx
git commit -m "feat(capture): add edge-swipe open/close gesture to CaptureSidebar reveal"
```

---

### Task 9: Add swipe-to-delete to `CaptureSidebar` recording rows

**Files:**
- Modify: `apps/web/src/components/soul/capture/CaptureSidebar.tsx`
- Modify: `apps/web/src/__tests__/CaptureSidebar.test.tsx` (extend, from Task 6)

**Interfaces:**
- Consumes: `api.sessions.deleteSession` (existing Convex mutation, same one `SavedAudioPanel` used — see Problem statement in the spec)

**Note on test scope:** same caveat as Task 8 — the drag-to-reveal animation itself isn't asserted (jsdom can't drive real pointer capture), but the Delete button is always present in the DOM (visually behind the row, revealed by the row's drag transform), so the confirm-and-delete *logic* is fully testable by interacting with it directly.

- [ ] **Step 1: Write the failing test**

Extend `apps/web/src/__tests__/CaptureSidebar.test.tsx` — replace the `convex/react` mock's `useMutation` line and add two tests. Full updated file:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptureSidebar } from '@/components/soul/capture/CaptureSidebar';

const mockDeleteSession = vi.fn().mockResolvedValue({ success: true });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [
      { id: 'session_1', name: 'Morning thoughts', createdAt: Date.now(), durationMs: 65000 },
    ],
  }),
  useMutation: () => mockDeleteSession,
}));

vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: {
      listMySessionsPaginated: 'sessions:listMySessionsPaginated',
      deleteSession: 'sessions:deleteSession',
    },
  },
}));

describe('CaptureSidebar', () => {
  beforeEach(() => {
    mockDeleteSession.mockClear();
  });

  it('does not render a "New recording" button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('New recording')).not.toBeInTheDocument();
  });

  it('still renders the Settings button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('opens a confirmation dialog when a recording row is deleted', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Delete Morning thoughts'));
    expect(screen.getByText('Delete this recording?')).toBeInTheDocument();
  });

  it('calls deleteSession with the correct id when the dialog is confirmed', async () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Delete Morning thoughts'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith({ sessionId: 'session_1' });
    });
    await waitFor(() => {
      expect(screen.queryByText('Delete this recording?')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run CaptureSidebar`
Expected: FAIL — no element with label "Delete Morning thoughts" exists yet

- [ ] **Step 3: Implement swipe-to-delete**

In `apps/web/src/components/soul/capture/CaptureSidebar.tsx`, update imports:
```tsx
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Folders, Menu, Plus, Settings, Trash } from 'griddy-icons';
import { api } from '@Ordio/convex';
import { captureGlossyBtn } from '@/lib/variants';
import { formatDuration } from '@/components/saved-audio/formatters';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

Inside `CaptureSidebar`, after the `sessions` destructure, add:
```tsx
  const deleteSession = useMutation(api.sessions.deleteSession);
  const [pendingDelete, setPendingDelete] = useState<(typeof sessions)[number] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSession({ sessionId: pendingDelete.id });
    } catch {
      toast.error('Failed to delete recording');
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }, [deleteSession, pendingDelete]);
```

Replace the Recents list (currently):
```tsx
      <div className="flex-1 overflow-y-auto px-2 pb-3 capture-scroll-thin">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => handleSelect(session.id)}
            className="w-full text-left px-3 py-3 text-base text-white/85 rounded-[10px] cursor-pointer truncate hover:bg-white/5"
          >
            {session.name}
            <span className="block text-[13px] text-white/40 font-mono">
              {formatRecentMeta(session.durationMs, session.createdAt)}
            </span>
          </button>
        ))}
      </div>
```
with:
```tsx
      <div className="flex-1 overflow-y-auto px-2 pb-3 capture-scroll-thin">
        {sessions.map((session) => (
          <div key={session.id} className="relative overflow-hidden rounded-[10px] mb-0.5">
            <button
              type="button"
              onClick={() => setPendingDelete(session)}
              aria-label={`Delete ${session.name}`}
              className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[#ff453a] text-white"
            >
              <Trash size={18} />
            </button>
            <motion.div
              drag="x"
              dragConstraints={{ left: -80, right: 0 }}
              dragElastic={0.06}
              dragMomentum={false}
              className="relative bg-[color:var(--sheet-bg)]"
            >
              <button
                type="button"
                onClick={() => handleSelect(session.id)}
                className="w-full text-left px-3 py-3 text-base text-white/85 cursor-pointer truncate hover:bg-white/5"
              >
                {session.name}
                <span className="block text-[13px] text-white/40 font-mono">
                  {formatRecentMeta(session.durationMs, session.createdAt)}
                </span>
              </button>
            </motion.div>
          </div>
        ))}
      </div>
```

Add the confirmation dialog right before the closing `</div>` of the component's root `<div className="flex flex-col h-full">`:
```tsx
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-white">Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {pendingDelete ? `"${pendingDelete.name}" will be permanently deleted.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-[#ff453a] text-white hover:bg-[#ff453a]/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run CaptureSidebar`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean

- [ ] **Step 6: Manual verification (drag physics)**

In the running app, confirm swiping a recording row left reveals the red Trash action, and that it stays revealed until released past the threshold.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/soul/capture/CaptureSidebar.tsx apps/web/src/__tests__/CaptureSidebar.test.tsx
git commit -m "feat(capture): add swipe-to-delete with confirmation to CaptureSidebar rows"
```

---

### Task 10: Delete dead `SavedAudioPanel` code

**Files:**
- Delete: `apps/web/src/components/saved-audio/SavedAudioPanel.tsx`
- Delete: `apps/web/src/components/saved-audio/SavedAudioDialogs.tsx`

**Interfaces:**
- None — confirmed zero live imports of either file anywhere in the app (only a stale comment reference to "SavedAudioDialogs" in `FileConfirmDialog.tsx`, not an import).

- [ ] **Step 1: Confirm no imports exist before deleting**

Run: `grep -rln "SavedAudioPanel\|SavedAudioDialogs" apps/web/src --include="*.tsx" --include="*.ts"`
Expected output: only the two files being deleted, plus `FileConfirmDialog.tsx` (a comment, not an import — verify with `grep -n "SavedAudioDialogs" apps/web/src/components/soul/states/FileConfirmDialog.tsx` showing a `*` comment line, not an `import` statement)

- [ ] **Step 2: Delete the files**

```bash
rm apps/web/src/components/saved-audio/SavedAudioPanel.tsx
rm apps/web/src/components/saved-audio/SavedAudioDialogs.tsx
```

- [ ] **Step 3: Verify `formatters.ts` (still used by `CaptureSidebar`) was not touched**

Run: `ls apps/web/src/components/saved-audio/`
Expected: `formatters.ts` still present (and any test file for it, if one exists)

- [ ] **Step 4: Verify full type-check and full test suite**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec vitest run`
Expected: both clean — deleting these files removes no live dependency

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/components/saved-audio/
git commit -m "chore(capture): delete unused SavedAudioPanel and SavedAudioDialogs"
```

---

## Post-Plan Verification

After Task 10, run the full suite once more end-to-end:

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
grep -rn "glass-bg" apps/web/src   # expect: no output
grep -rln "SavedAudioPanel\|SavedAudioDialogs" apps/web/src   # expect: no output
```

Then do the two manual-verification passes from Tasks 8 and 9 together in one session (edge-swipe open/close, swipe-to-delete reveal) before considering this plan complete.
