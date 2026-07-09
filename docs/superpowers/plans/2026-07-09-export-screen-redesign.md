# Export Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the export screen (`soul/states/ExportState/`) in a new `soul/export/` folder, adopting the capture page's 440px morphing-dock shell, floating sheets, and a full-screen post-export share takeover — with zero changes to export/trim business logic.

**Architecture:** Mirror the capture screen's file shape exactly: a shell component (`ExportScreen`) composed of a thin header, a hero stage, a morphing bottom dock, two floating sheets, and (new) a share takeover overlay. A pure `deriveExportPhase` function and a `useTrimHistory` hook carry over the old `index.tsx`'s state logic unchanged. The old `states/ExportState/` folder is deleted once `app/create/export/[sessionId]/page.tsx` and `soul/index.ts` point at the new folder.

**Tech Stack:** Next.js 15 / React, Tailwind + CVA (`lib/variants.ts`), Framer Motion, Zustand stores, Vitest.

## Global Constraints

- No inline style props for variants — all new variant styling goes through CVA in `lib/variants.ts` (no hardcoded Tailwind class strings in JSX, no arbitrary values).
- Always `next/image`, never `<img>`.
- Shared easing curve `EASE = [0.32, 0.72, 0, 1]` (from `CaptureScreen.tsx`) for all new motion.
- Every async state (`exporting`) must have an explicit path back to a safe state (`preview`) — verify cancel and error branches before marking a task done.
- Export/trim business logic (`buildAudioBuffer`, the transcript swap around `exporter.startExport`, undo/redo snapshot bounds `MAX_HISTORY = 5`) moves **unchanged** — this is a re-skin, not a logic rewrite.
- Batch-test workflow: run the full suite once at the end of the plan, not per task (per user's workflow preference) — individual tasks still write and run their own new unit tests as they're the only way to TDD the new pure functions/hooks.
- No `Co-Authored-By: Claude` in commits.

---

### Task 1: Export dock CVA variants

**Files:**
- Modify: `apps/web/src/lib/variants.ts` (append after `captureRoundBtn`, ~line 168)

**Interfaces:**
- Consumes: existing `captureGlossyBtn` string (`lib/variants.ts:122`).
- Produces: `exportCenterSlot` (CVA, variant key `phase: 'preview' | 'exporting' | 'done'`), `exportSheetSurface` (plain string) — later tasks import both from `@/lib/variants`.

- [ ] **Step 1: Add the variants**

```typescript
/**
 * Export dock center slot — "Export video" pill (preview), progress fill (exporting),
 * or "Download" pill (done). Mirrors captureCenterSlot's phase-keyed sizing/radius pattern.
 */
export const exportCenterSlot = cva(
  'flex-1 min-w-0 relative flex items-center justify-center overflow-hidden border-none transition-all duration-300',
  {
    variants: {
      phase: {
        preview: 'h-11.5 bg-white rounded-full cursor-pointer',
        exporting: 'h-2.5 bg-white/10 rounded-full cursor-default',
        done: 'h-11.5 bg-white rounded-full cursor-pointer',
      },
    },
  }
);

/**
 * Floating sheet surface — shared by StyleSheet/EditSheet, matching UploadActionSheet's
 * rounded dark container.
 */
export const exportSheetSurface = 'rounded-[28px] overflow-hidden bg-[#0d0d10]';
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/variants.ts
git commit -m "feat(export): add export dock and sheet CVA variants"
```

---

### Task 2: `deriveExportPhase` + types

**Files:**
- Create: `apps/web/src/components/soul/export/types.ts`
- Create: `apps/web/src/components/soul/export/phase.ts`
- Test: `apps/web/src/__tests__/export-phase.test.ts`

**Interfaces:**
- Produces: `ExportPhase = 'preview' | 'exporting' | 'done'`, `DeriveExportPhaseInput { isExporting: boolean; exportedUrl: string | null; error: string | null }`, `deriveExportPhase(input): ExportPhase`. Later tasks (`ExportDock`, `ExportScreen`, `ShareTakeover`) consume this type and function.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/export-phase.test.ts
import { describe, it, expect } from 'vitest';
import { deriveExportPhase } from '@/components/soul/export/phase';

describe('deriveExportPhase', () => {
  it('is preview when nothing has started', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: null, error: null })).toBe('preview');
  });

  it('is exporting while isExporting is true, even if a stale exportedUrl exists', () => {
    expect(deriveExportPhase({ isExporting: true, exportedUrl: 'blob:old', error: null })).toBe('exporting');
  });

  it('is done once exportedUrl is set and export has finished', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: 'blob:new', error: null })).toBe('done');
  });

  it('falls back to preview on error, even if a stale exportedUrl exists', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: 'blob:old', error: 'boom' })).toBe('preview');
  });

  it('prioritizes isExporting over a simultaneous error from a previous attempt', () => {
    expect(deriveExportPhase({ isExporting: true, exportedUrl: null, error: 'stale error' })).toBe('exporting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/__tests__/export-phase.test.ts`
Expected: FAIL — `Cannot find module '@/components/soul/export/phase'`

- [ ] **Step 3: Write `types.ts`**

```typescript
// apps/web/src/components/soul/export/types.ts

/** The three visual phases the Export screen's dock morphs through. */
export type ExportPhase = 'preview' | 'exporting' | 'done';

export interface DeriveExportPhaseInput {
  isExporting: boolean;
  exportedUrl: string | null;
  error: string | null;
}
```

- [ ] **Step 4: Write `phase.ts`**

```typescript
// apps/web/src/components/soul/export/phase.ts
import type { DeriveExportPhaseInput, ExportPhase } from './types';

/**
 * Pure, total derivation of the dock's visual phase. Check isExporting first so an
 * in-flight export always wins over a stale error or a stale exportedUrl left over
 * from a previous attempt; check error next so a failed export falls back to preview
 * (the state-exit rule) rather than getting stuck showing a stale success state.
 */
export function deriveExportPhase(input: DeriveExportPhaseInput): ExportPhase {
  const { isExporting, exportedUrl, error } = input;

  if (isExporting) return 'exporting';
  if (error) return 'preview';
  if (exportedUrl) return 'done';
  return 'preview';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/__tests__/export-phase.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/export/types.ts apps/web/src/components/soul/export/phase.ts apps/web/src/__tests__/export-phase.test.ts
git commit -m "feat(export): add deriveExportPhase for the new export shell"
```

---

### Task 3: `useTrimHistory` hook (extracted, unchanged logic)

**Files:**
- Create: `apps/web/src/components/soul/export/useTrimHistory.ts`
- Test: `apps/web/src/__tests__/useTrimHistory.test.ts`

**Interfaces:**
- Consumes: `useAudioTrimmer` (`@/hooks/audio/useAudioTrimmer`, `UseAudioTrimmerReturn`), `useCaptureStore`, `useProcessingStore` (`@/stores`), `UsePlaybackReturn` (`@/hooks/playback/usePlayback`), `Word` (`@Ordio/shared/schemas`).
- Produces: `useTrimHistory(params: { playback: UsePlaybackReturn; trimmer: UseAudioTrimmerReturn }): { canUndo: boolean; canRedo: boolean; commit: () => void; undo: () => void; redo: () => void }`. `ExportScreen` (Task 9) consumes this hook directly in place of the old inline `past`/`future`/`handleCommitTrim`/`handleUndoTrim`/`handleRedoTrim` in `index.tsx`.

This is a straight extraction of `index.tsx:79-137` (see `states/ExportState/index.tsx`) into a hook — no behavior change. `buildAudioBuffer` moves with it since it's only used here and in `handleExport` (Task 9 keeps its own copy inline, matching the old file's structure, since `handleExport` isn't part of the history logic).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/useTrimHistory.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrimHistory } from '@/components/soul/export/useTrimHistory';
import { useCaptureStore, useProcessingStore } from '@/stores';

function makeBuffer(length: number, sampleRate = 48000): AudioBuffer {
  const buf = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  buf.copyToChannel(new Float32Array(length).fill(0.5), 0);
  return buf;
}

describe('useTrimHistory', () => {
  beforeEach(() => {
    useCaptureStore.getState().resetCapture();
    useProcessingStore.getState().resetProcessing();
  });

  it('starts with no undo/redo available', () => {
    useCaptureStore.getState().setAudioBuffer(makeBuffer(1000));
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = { hasChanges: false, isEmpty: false, getTrimmedAudio: vi.fn(), getTrimmedTranscript: vi.fn(), resetAll: vi.fn() } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('commit pushes the pre-commit buffer onto history, enabling undo', () => {
    const original = makeBuffer(1000);
    useCaptureStore.getState().setAudioBuffer(original);
    useProcessingStore.getState().setTranscript([]);

    const trimmedChannel = new Float32Array(500).fill(0.5);
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = {
      hasChanges: true,
      isEmpty: false,
      getTrimmedAudio: vi.fn(() => [trimmedChannel]),
      getTrimmedTranscript: vi.fn(() => []),
      resetAll: vi.fn(),
    } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));

    act(() => result.current.commit());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(useCaptureStore.getState().audioBuffer).not.toBe(original);
    expect(useCaptureStore.getState().audioBuffer?.length).toBe(500);
  });

  it('undo restores the previous buffer and enables redo', () => {
    const original = makeBuffer(1000);
    useCaptureStore.getState().setAudioBuffer(original);
    useProcessingStore.getState().setTranscript([]);

    const trimmedChannel = new Float32Array(500).fill(0.5);
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = {
      hasChanges: true,
      isEmpty: false,
      getTrimmedAudio: vi.fn(() => [trimmedChannel]),
      getTrimmedTranscript: vi.fn(() => []),
      resetAll: vi.fn(),
    } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));
    act(() => result.current.commit());
    act(() => result.current.undo());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(useCaptureStore.getState().audioBuffer).toBe(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/__tests__/useTrimHistory.test.ts`
Expected: FAIL — `Cannot find module '@/components/soul/export/useTrimHistory'`

- [ ] **Step 3: Write the hook**

```typescript
// apps/web/src/components/soul/export/useTrimHistory.ts
'use client';

import { useCallback, useState } from 'react';
import { useCaptureStore, useProcessingStore } from '@/stores';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { Word } from '@Ordio/shared/schemas';

type TrimSnapshot = { audioBuffer: AudioBuffer; transcript: Word[] };
const MAX_HISTORY = 5;

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  });
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  );
  return buf;
}

interface UseTrimHistoryParams {
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
}

export interface UseTrimHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  commit: () => void;
  undo: () => void;
  redo: () => void;
}

export function useTrimHistory({ playback, trimmer }: UseTrimHistoryParams): UseTrimHistoryReturn {
  const [past, setPast] = useState<TrimSnapshot[]>([]);
  const [future, setFuture] = useState<TrimSnapshot[]>([]);

  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);

  const restoreSnapshot = useCallback(
    (snap: TrimSnapshot) => {
      useCaptureStore.getState().setAudioBuffer(snap.audioBuffer);
      useProcessingStore.getState().setTranscript(snap.transcript);
      playback.load(snap.audioBuffer);
      trimmer.resetAll(snap.audioBuffer.duration);
    },
    [playback, trimmer]
  );

  const commit = useCallback(() => {
    if (!audioBuffer || !trimmer.hasChanges) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript ?? []);
    if ((trimmedChannels[0]?.length ?? 0) === 0) return;
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript ?? []);

    setPast((prev) => [
      ...prev.slice(-(MAX_HISTORY - 1)),
      { audioBuffer, transcript: transcript ?? [] },
    ]);
    setFuture([]);

    useCaptureStore.getState().setAudioBuffer(trimmedBuffer);
    useProcessingStore.getState().setTranscript(trimmedTranscript);
    playback.load(trimmedBuffer);
    trimmer.resetAll(trimmedBuffer.duration);
  }, [audioBuffer, transcript, trimmer, playback]);

  const undo = useCallback(() => {
    if (past.length === 0 || !audioBuffer) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ audioBuffer, transcript: transcript ?? [] }, ...f.slice(0, MAX_HISTORY - 1)]);
    restoreSnapshot(prev);
  }, [past, audioBuffer, transcript, restoreSnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0 || !audioBuffer) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: transcript ?? [] }]);
    restoreSnapshot(next);
  }, [future, audioBuffer, transcript, restoreSnapshot]);

  return { canUndo: past.length > 0, canRedo: future.length > 0, commit, undo, redo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/__tests__/useTrimHistory.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/export/useTrimHistory.ts apps/web/src/__tests__/useTrimHistory.test.ts
git commit -m "feat(export): extract trim undo/redo history into useTrimHistory hook"
```

---

### Task 4: `ExportHeader` (capture-style thin header)

**Files:**
- Create: `apps/web/src/components/soul/export/ExportHeader.tsx`

**Interfaces:**
- Consumes: `ExportPhase` (Task 2), `captureNavBtn` (`@/lib/variants`), `ArrowLeft`/`Menu` icons from `griddy-icons` (pattern from `CaptureHeader.tsx`).
- Produces: `ExportHeaderProps { phase: ExportPhase; onBack: () => void }`. Consumed by `ExportScreen` (Task 9).

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/soul/export/ExportHeader.tsx
'use client';

import { ArrowLeft } from 'griddy-icons';
import { captureNavBtn } from '@/lib/variants';
import type { ExportPhase } from './types';

interface ExportHeaderProps {
  phase: ExportPhase;
  onBack: () => void;
}

const TITLE: Record<ExportPhase, string> = {
  preview: 'Preview',
  exporting: 'Exporting…',
  done: 'Ready to share',
};

export function ExportHeader({ phase, onBack }: ExportHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4.5 z-20">
      <button type="button" onClick={onBack} className={captureNavBtn} aria-label="Back">
        <ArrowLeft size={15} />
      </button>
      <span className="text-white/60 text-[15px] font-medium">{TITLE[phase]}</span>
      <div className="w-9 h-9" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/soul/export/ExportHeader.tsx
git commit -m "feat(export): add capture-style ExportHeader"
```

---

### Task 5: `ExportStage` (hero canvas, strip removed)

**Files:**
- Create: `apps/web/src/components/soul/export/ExportStage.tsx`

**Interfaces:**
- Consumes: `CanvasPreview` (`@/components/primitives/video/CanvasPreview`), `PlaybackControls` (`@/components/primitives/video/PlaybackControls`), `UsePlaybackReturn`, `WaveformVariant | CaptionMode | CanvasLayout | FormatVariant | GraphicStyleId` (`@/stores`).
- Produces: `ExportStageProps` (same shape as old `ExportCanvasProps` minus `onLocked`, since style controls move to `StyleSheet`). Consumed by `ExportScreen` (Task 9).

This drops `StageControlBar` entirely (it moves into `StyleSheet`, Task 6) and the fixed-header offset (`mt-16`/`pt-[env(safe-area-inset-top)]`) since the new shell's header is `absolute`, not `fixed`, matching `CaptureStage`'s positioning model.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/soul/export/ExportStage.tsx
'use client';

import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import PlaybackControls from '@/components/primitives/video/PlaybackControls';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';

interface ExportStageProps {
  playback: UsePlaybackReturn;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  canvasLayout?: CanvasLayout;
  graphicStyle?: GraphicStyleId;
  showWatermark?: boolean;
}

export function ExportStage({
  playback,
  format,
  waveformStyle,
  captionMode,
  canvasLayout,
  graphicStyle,
  showWatermark,
}: ExportStageProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 pt-16 pb-32">
      <div className="relative w-full max-w-[min(100%,20rem)]">
        <CanvasPreview
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          captionMode={captionMode}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
        />
      </div>
      <PlaybackControls playback={playback} className="w-full max-w-[min(100%,20rem)]" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/soul/export/ExportStage.tsx
git commit -m "feat(export): add ExportStage hero canvas without control strip"
```

---

### Task 6: `StyleSheet` (visual/caption/stage pickers as a floating sheet)

**Files:**
- Create: `apps/web/src/components/soul/export/StyleSheet.tsx`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent` (`@/components/ui/sheet`), `exportSheetSurface` (Task 1), `useUIStore`, `useFeatureGates`, `LockBadge`, `FeatureKey`, `CanvasLayout | CaptionMode | GraphicStyleId | WaveformVariant` (`@/stores`) — same option tables as `StageControlBar.tsx`.
- Produces: `StyleSheetProps { isOpen: boolean; onClose: () => void; onLocked: (feature: FeatureKey) => void }`. Consumed by `ExportScreen` (Task 9).

This re-implements `StageControlBar`'s three pickers (Visual/Caption/Stage) as sheet rows instead of a horizontal popover strip, following `UploadActionSheet`'s row layout (icon-less rows here, label + current value, tap opens an inline expandable list — simpler than three separate popovers since the sheet already has vertical room). Graphics sub-options collapse under "Visual" exactly as before.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/soul/export/StyleSheet.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { exportSheetSurface } from '@/lib/variants';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import type { CanvasLayout, CaptionMode, GraphicStyleId, WaveformVariant } from '@/stores';

interface StyleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

const WAVEFORM_OPTIONS: { value: WaveformVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'Clean' },
];

const GRAPHIC_OPTIONS: { value: Exclude<GraphicStyleId, null>; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
];

const MODE_OPTIONS: { value: CaptionMode; label: string; gate?: FeatureKey }[] = [
  { value: 'phrase', label: 'Pop' },
  { value: 'karaoke', label: 'Lyrics', gate: 'caption_karaoke' },
  { value: 'stack', label: 'Stack' },
  { value: 'spotlight', label: 'Spotlight' },
];

const LAYOUT_OPTIONS: { value: CanvasLayout; label: string; gate?: FeatureKey }[] = [
  { value: 'top', label: 'Upper' },
  { value: 'compact', label: 'Tight' },
  { value: 'flipped', label: 'Lower', gate: 'layout_flipped' },
];

function OptionRow<T extends string>({
  label,
  value,
  selected,
  locked,
  gate,
  onSelect,
  onLocked,
}: {
  label: string;
  value: T;
  selected: boolean;
  locked: boolean;
  gate?: FeatureKey;
  onSelect: (v: T) => void;
  onLocked: (feature: FeatureKey) => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onSelect(value)}
      className={cn(
        'w-full flex items-center justify-between px-5 py-3 text-left text-white border-b border-white/10 last:border-b-0',
        selected && 'bg-white/8',
        locked && 'opacity-50'
      )}
    >
      <span className="text-[15px]">{label}</span>
      {locked && gate && <LockBadge onClick={() => onLocked(gate)} label={`${label} requires Creator`} />}
    </button>
  );
}

export function StyleSheet({ isOpen, onClose, onLocked }: StyleSheetProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle);
  const captionMode = useUIStore((s) => s.captionMode);
  const setCaptionMode = useUIStore((s) => s.setCaptionMode);
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout);
  const { isLocked } = useFeatureGates();
  const [section, setSection] = useState<'visual' | 'caption' | 'stage'>('visual');
  const lyricsOwnsStage = captionMode === 'karaoke';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-auto max-h-[75vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="flex gap-1.5 mb-2.5 rounded-full bg-white/6 border border-white/14 p-1">
          {(['visual', 'caption', 'stage'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={cn(
                'flex-1 h-9 rounded-full text-[13px] font-semibold text-white/60',
                section === s && 'bg-white/12 text-white'
              )}
            >
              {s === 'visual' ? 'Visual' : s === 'caption' ? 'Caption' : 'Stage'}
            </button>
          ))}
        </div>

        <div className={exportSheetSurface}>
          {section === 'visual' &&
            (lyricsOwnsStage ? (
              <div className="px-5 py-4 text-white/45 text-[14px]">Full-stage lyrics mode active</div>
            ) : (
              <>
                {WAVEFORM_OPTIONS.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    selected={graphicStyle === null && waveformStyle === o.value}
                    locked={o.gate ? isLocked(o.gate) : false}
                    gate={o.gate}
                    onSelect={(v) => {
                      setGraphicStyle(null);
                      setWaveformStyle(v);
                    }}
                    onLocked={onLocked}
                  />
                ))}
                {GRAPHIC_OPTIONS.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    selected={graphicStyle === o.value}
                    locked={false}
                    onSelect={setGraphicStyle}
                    onLocked={onLocked}
                  />
                ))}
              </>
            ))}

          {section === 'caption' &&
            MODE_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                value={o.value}
                selected={captionMode === o.value}
                locked={o.gate ? isLocked(o.gate) : false}
                gate={o.gate}
                onSelect={setCaptionMode}
                onLocked={onLocked}
              />
            ))}

          {section === 'stage' &&
            LAYOUT_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                value={o.value}
                selected={canvasLayout === o.value}
                locked={o.gate ? isLocked(o.gate) : false}
                gate={o.gate}
                onSelect={setCanvasLayout}
                onLocked={onLocked}
              />
            ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2.5 py-4 rounded-[28px] bg-white/6 border border-white/14 text-white text-lg font-semibold"
        >
          Done
        </button>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/soul/export/StyleSheet.tsx
git commit -m "feat(export): add StyleSheet replacing StageControlBar popovers"
```

---

### Task 7: `EditSheet` (Trim + Captions tabs)

**Files:**
- Create: `apps/web/src/components/soul/export/EditSheet.tsx`

**Interfaces:**
- Consumes: `TrimPanel` (`@/components/soul/editor/TrimPanel`), `CaptionEditor` (`@/components/soul/captions/CaptionEditor`), `FormatToggle` (`@/components/soul/shared/FormatToggle`), `Sheet`/`SheetContent`, `ScrollArea` (`@/components/ui/scroll-area`), `UseAudioTrimmerReturn`, `UsePlaybackReturn`, `Word`, `UseTrimHistoryReturn` (Task 3).
- Produces: `EditSheetProps { isOpen: boolean; onClose: () => void; playback: UsePlaybackReturn; trimmer: UseAudioTrimmerReturn; history: UseTrimHistoryReturn; onLocked: (feature: FeatureKey) => void }`. Consumed by `ExportScreen` (Task 9).

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/soul/export/EditSheet.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import CaptionEditor from '@/components/soul/captions/CaptionEditor';
import { TrimPanel } from '@/components/soul/editor/TrimPanel';
import FormatToggle from '@/components/soul/shared/FormatToggle';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { UseTrimHistoryReturn } from './useTrimHistory';
import type { FeatureKey } from '@/lib/featureGates';

interface EditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
  history: UseTrimHistoryReturn;
  onLocked: (feature: FeatureKey) => void;
}

export function EditSheet({ isOpen, onClose, playback, trimmer, history, onLocked }: EditSheetProps) {
  const [tab, setTab] = useState<'trim' | 'captions' | 'format'>('trim');

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-[70vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="flex flex-col h-full rounded-[28px] overflow-hidden bg-[#0d0d10]">
          <div className="flex gap-1.5 p-2.5 shrink-0">
            {(['trim', 'captions', 'format'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 h-9 rounded-full text-[13px] font-semibold text-white/60',
                  tab === t && 'bg-white/12 text-white'
                )}
              >
                {t === 'trim' ? 'Trim' : t === 'captions' ? 'Captions' : 'Reframe'}
              </button>
            ))}
          </div>

          {tab === 'captions' ? (
            <div className="flex-1 min-h-0 px-4 pb-4">
              <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-4 pb-4">
                {tab === 'trim' && (
                  <TrimPanel
                    audioBuffer={null}
                    trimmer={trimmer}
                    onCommit={history.commit}
                    onUndo={history.undo}
                    onRedo={history.redo}
                    canUndo={history.canUndo}
                    canRedo={history.canRedo}
                    onPreviewAt={playback.previewAt}
                  />
                )}
                {tab === 'format' && <FormatToggle onLocked={onLocked} />}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Note for implementer:** `TrimPanel` requires a real `audioBuffer: AudioBuffer | null` prop from the caller (the placeholder `null` above is wrong) — `ExportScreen` (Task 9) passes the real `useCaptureStore((s) => s.audioBuffer)` value in; update this component's prop signature to accept `audioBuffer: AudioBuffer | null` as a prop instead of hardcoding `null` before wiring Task 9.

- [ ] **Step 2: Fix the placeholder — add `audioBuffer` to props**

```tsx
interface EditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
  audioBuffer: AudioBuffer | null;
  history: UseTrimHistoryReturn;
  onLocked: (feature: FeatureKey) => void;
}
```

And update the destructure + `TrimPanel` call to use `audioBuffer` (the real prop) instead of `null`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/soul/export/EditSheet.tsx
git commit -m "feat(export): add EditSheet with trim/caption/reframe tabs"
```

---

### Task 8: `ExportDock` (morphing bottom dock)

**Files:**
- Create: `apps/web/src/components/soul/export/ExportDock.tsx`

**Interfaces:**
- Consumes: `ExportPhase` (Task 2), `exportCenterSlot` (Task 1), `captureRoundBtn` (`@/lib/variants`), icons from `griddy-icons` (`Settings`, `Scissors` — verify export name in `griddy-icons`; capture uses `Settings`, `Refresh`, `Close`, `Stop`, `Pause`, `Play`, `Microphone`, `Upload` — if `Scissors` isn't exported, use `Refresh` as a stand-in icon and confirm against the installed package's type exports before committing).
- Produces: `ExportDockProps { phase: ExportPhase; progress: number; exportDisabled: boolean; onOpenStyle: () => void; onOpenEdit: () => void; onExport: () => void; onDownload: () => void; onCancelExport: () => void; onReset: () => void }`. Consumed by `ExportScreen` (Task 9).

- [ ] **Step 1: Verify available icons**

Run: `cd apps/web && node -e "console.log(Object.keys(require('griddy-icons')))" | tr ',' '\n' | grep -i "scis\|crop\|edit"`
Expected: prints available icon names; pick the closest match for "Edit" (e.g. `Edit` or `Crop`) — substitute into Step 2 in place of `Scissors` if it doesn't exist.

- [ ] **Step 2: Write the component**

```tsx
// apps/web/src/components/soul/export/ExportDock.tsx
'use client';

import { Settings, Edit, Refresh, Close } from 'griddy-icons';
import { cn } from '@/lib/utils';
import { exportCenterSlot, captureRoundBtn } from '@/lib/variants';
import type { ExportPhase } from './types';

interface ExportDockProps {
  phase: ExportPhase;
  progress: number;
  exportDisabled: boolean;
  onOpenStyle: () => void;
  onOpenEdit: () => void;
  onExport: () => void;
  onDownload: () => void;
  onCancelExport: () => void;
  onReset: () => void;
}

export function ExportDock({
  phase,
  progress,
  exportDisabled,
  onOpenStyle,
  onOpenEdit,
  onExport,
  onDownload,
  onCancelExport,
  onReset,
}: ExportDockProps) {
  return (
    <div className="absolute left-0 right-0 bottom-0 px-5 pb-10 z-20">
      <div className="flex items-center gap-3 w-full min-h-15">
        {phase !== 'exporting' && (
          <button
            type="button"
            onClick={phase === 'done' ? onReset : onOpenStyle}
            className={captureRoundBtn({ tone: 'neutral' })}
            aria-label={phase === 'done' ? 'Start a new recording' : 'Style'}
          >
            {phase === 'done' ? <Refresh size={18} /> : <Settings size={20} />}
          </button>
        )}

        <button
          type="button"
          onClick={phase === 'preview' ? onExport : phase === 'done' ? onDownload : undefined}
          disabled={phase === 'preview' && exportDisabled}
          className={cn(exportCenterSlot({ phase }))}
          aria-label={phase === 'preview' ? 'Export video' : phase === 'done' ? 'Download' : undefined}
        >
          {phase === 'preview' && (
            <span className="text-black font-semibold text-base whitespace-nowrap">Export video</span>
          )}
          {phase === 'done' && (
            <span className="text-black font-semibold text-base whitespace-nowrap">Download</span>
          )}
          {phase === 'exporting' && (
            <span
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-[width] duration-120 ease-linear"
              style={{ width: `${Math.round(progress)}%` }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={phase === 'exporting' ? onCancelExport : onOpenEdit}
          className={captureRoundBtn({ tone: phase === 'exporting' ? 'danger' : 'neutral' })}
          aria-label={phase === 'exporting' ? 'Cancel export' : 'Edit'}
        >
          {phase === 'exporting' ? <Close size={18} /> : <Edit size={18} />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors (fix any icon import name mismatch found in Step 1 first).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/soul/export/ExportDock.tsx
git commit -m "feat(export): add morphing ExportDock (preview/exporting/done)"
```

---

### Task 9: `ShareTakeover` (full-screen post-export celebration)

**Files:**
- Create: `apps/web/src/components/soul/export/ShareTakeover.tsx`

**Interfaces:**
- Consumes: `ShareCard`, `ShareCardVariant` (moved in Task 10), `acidPill` (`@/lib/variants`), `motion`/`AnimatePresence` (`framer-motion`), `Word` (`@Ordio/shared/schemas`).
- Produces: `ShareTakeoverProps { isVisible: boolean; headline: string; durationSeconds: number }`. Consumed by `ExportScreen` (Task 9→10; variant state itself lives in `ExportScreen` and is passed down, matching the old `ExportFooter`'s local `variant` state).

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/soul/export/ShareTakeover.tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { acidPill } from '@/lib/variants';
import { ShareCard, type ShareCardVariant } from './ShareCard';

interface ShareTakeoverProps {
  isVisible: boolean;
  headline: string;
  durationSeconds: number;
}

const VARIANTS: ShareCardVariant[] = ['acid', 'sunset', 'electric'];
const EASE = [0.32, 0.72, 0, 1] as const;

export function ShareTakeover({ isVisible, headline, durationSeconds }: ShareTakeoverProps) {
  const [variant, setVariant] = useState<ShareCardVariant>('acid');

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black px-6 pb-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.36, ease: EASE }}
        >
          <div className="w-full max-w-[240px]">
            <ShareCard headline={headline} durationSeconds={durationSeconds} variant={variant} />
          </div>

          <div className="flex gap-1.5 rounded-acid-md bg-acid-surface-1 p-1" role="tablist" aria-label="Share card color">
            {VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={variant === v}
                onClick={() => setVariant(v)}
                className={acidPill({ active: variant === v })}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors (will resolve once `ShareCard` exists at the new path in Task 10).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/soul/export/ShareTakeover.tsx
git commit -m "feat(export): add full-screen ShareTakeover for post-export celebration"
```

---

### Task 10: Move `ShareCard` and `DiscardDialog`; assemble `ExportScreen`

**Files:**
- Create: `apps/web/src/components/soul/export/ShareCard.tsx` (moved from `states/ExportState/ShareCard.tsx`, unchanged)
- Create: `apps/web/src/components/soul/export/DiscardDialog.tsx` (moved from `states/ExportState/DiscardDialog.tsx`, unchanged)
- Create: `apps/web/src/components/soul/export/ExportScreen.tsx`
- Create: `apps/web/src/components/soul/export/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–9, plus `useAudioTrimmer` (`@/hooks/audio/useAudioTrimmer`), `getCanvasDimensions`, `useCaptureStore`, `useProcessingStore`, `useUIStore` (`@/stores`), `UsePlaybackReturn`, `FeatureKey`, `Word`.
- Produces: `ExportScreen` default export with the **exact same props shape** as the old `ExportState` (`ExportStateProps` in `states/ExportState/index.tsx:36-49`) so Task 11 is a pure import swap.

- [ ] **Step 1: Copy `ShareCard.tsx` and `DiscardDialog.tsx` unchanged**

```bash
cp apps/web/src/components/soul/states/ExportState/ShareCard.tsx apps/web/src/components/soul/export/ShareCard.tsx
cp apps/web/src/components/soul/states/ExportState/DiscardDialog.tsx apps/web/src/components/soul/export/DiscardDialog.tsx
```

- [ ] **Step 2: Write `ExportScreen.tsx`**

```tsx
// apps/web/src/components/soul/export/ExportScreen.tsx
'use client';

import { useCallback, useState } from 'react';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import { getCanvasDimensions, useCaptureStore, useProcessingStore, useUIStore } from '@/stores';
import { ExportHeader } from './ExportHeader';
import { ExportStage } from './ExportStage';
import { ExportDock } from './ExportDock';
import { StyleSheet } from './StyleSheet';
import { EditSheet } from './EditSheet';
import { ShareTakeover } from './ShareTakeover';
import { DiscardDialog } from './DiscardDialog';
import { useTrimHistory } from './useTrimHistory';
import { deriveExportPhase } from './phase';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import type { Word } from '@Ordio/shared/schemas';

interface UseVideoExporterShape {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}

interface ExportScreenProps {
  playback: UsePlaybackReturn;
  exporter: UseVideoExporterShape;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  canvasLayout?: CanvasLayout;
  graphicStyle?: GraphicStyleId;
  showWatermark?: boolean;
  onExportStart: () => Promise<boolean>;
  onDownload: () => void;
  onReset: () => void;
  onLocked: (feature: FeatureKey) => void;
}

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0]?.length ?? 0, sampleRate });
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  );
  return buf;
}

function headlineFromTranscript(transcript: Word[] | undefined): string {
  if (!transcript || transcript.length === 0) return 'Say it out loud.';
  return transcript.slice(0, 8).map((w) => w.text).join(' ').trim();
}

export default function ExportScreen({
  playback,
  exporter,
  format,
  waveformStyle,
  captionMode,
  canvasLayout,
  graphicStyle,
  showWatermark = false,
  onExportStart,
  onDownload,
  onReset,
  onLocked,
}: ExportScreenProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);
  const trimmer = useAudioTrimmer(playback.duration);
  const history = useTrimHistory({ playback, trimmer });

  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return;

    const allowed = await onExportStart();
    if (!allowed) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript);
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript);

    const { width, height } = getCanvasDimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const style = useUIStore.getState().style;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = style.backgroundColor ?? '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    const originalTranscript = useProcessingStore.getState().transcript;
    useProcessingStore.setState({ transcript: trimmedTranscript });

    try {
      await exporter.startExport(canvas, trimmedBuffer, showWatermark);
    } finally {
      useProcessingStore.setState({ transcript: originalTranscript });
    }
  }, [audioBuffer, transcript, trimmer, format, exporter, showWatermark, onExportStart]);

  const exportDisabled = exporter.isExporting || trimmer.isEmpty;
  const phase = deriveExportPhase({
    isExporting: exporter.isExporting,
    exportedUrl: exporter.exportedUrl,
    error: exporter.error,
  });

  return (
    <div className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto overflow-hidden select-none bg-black text-white">
      <ExportHeader phase={phase} onBack={() => setShowDiscardDialog(true)} />

      <ExportStage
        playback={playback}
        format={format}
        waveformStyle={waveformStyle}
        captionMode={captionMode}
        canvasLayout={canvasLayout}
        graphicStyle={graphicStyle}
        showWatermark={showWatermark}
      />

      <ShareTakeover
        isVisible={phase === 'done'}
        headline={headlineFromTranscript(transcript ?? undefined)}
        durationSeconds={audioBuffer?.duration ?? 0}
      />

      <ExportDock
        phase={phase}
        progress={exporter.exportProgress}
        exportDisabled={exportDisabled}
        onOpenStyle={() => setStyleOpen(true)}
        onOpenEdit={() => setEditOpen(true)}
        onExport={handleExport}
        onDownload={onDownload}
        onCancelExport={exporter.cancelExport}
        onReset={onReset}
      />

      <StyleSheet isOpen={styleOpen} onClose={() => setStyleOpen(false)} onLocked={onLocked} />
      <EditSheet
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        playback={playback}
        trimmer={trimmer}
        audioBuffer={audioBuffer}
        history={history}
        onLocked={onLocked}
      />

      <DiscardDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog} onConfirm={onReset} />
    </div>
  );
}
```

- [ ] **Step 3: Write the barrel export**

```typescript
// apps/web/src/components/soul/export/index.ts
export { default as ExportScreen } from './ExportScreen';
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors. Fix any prop mismatches surfaced between `ExportDock`/`StyleSheet`/`EditSheet` and this assembly before proceeding.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/soul/export/ShareCard.tsx apps/web/src/components/soul/export/DiscardDialog.tsx apps/web/src/components/soul/export/ExportScreen.tsx apps/web/src/components/soul/export/index.ts
git commit -m "feat(export): assemble ExportScreen shell from dock, sheets, and takeover"
```

---

### Task 11: Wire up the page, delete the old folder, full verification

**Files:**
- Modify: `apps/web/src/app/create/export/[sessionId]/page.tsx:15,157`
- Modify: `apps/web/src/components/soul/index.ts:6`
- Delete: `apps/web/src/components/soul/states/ExportState/` (entire directory)

**Interfaces:**
- Consumes: `ExportScreen` (Task 10).

- [ ] **Step 1: Swap the page import**

In `apps/web/src/app/create/export/[sessionId]/page.tsx`, replace:

```typescript
import ExportState from '@/components/soul/states/ExportState';
```

with:

```typescript
import ExportScreen from '@/components/soul/export/ExportScreen';
```

And replace the render call (same file, `<ExportState ... />`) with `<ExportScreen ... />`, keeping every prop unchanged — the props contract is identical by design.

Also update the surrounding `<main>` wrapper: the new shell owns its own `max-w-[440px] mx-auto` centering, so simplify

```tsx
<main id="main-content" className="min-h-dvh flex flex-col px-4 sm:px-6 relative">
  <ExportScreen ... />
```

to

```tsx
<main id="main-content" className="min-h-dvh flex items-center justify-center relative">
  <ExportScreen ... />
```

- [ ] **Step 2: Swap the barrel re-export**

In `apps/web/src/components/soul/index.ts`, replace:

```typescript
export { default as ExportState } from './states/ExportState';
```

with:

```typescript
export { default as ExportScreen } from './export/ExportScreen';
```

- [ ] **Step 3: Search for any remaining references to the old path**

Run: `cd apps/web && grep -rn "states/ExportState\|ExportState" src --include="*.ts" --include="*.tsx"`
Expected: no matches outside the directory about to be deleted (confirm before deleting).

- [ ] **Step 4: Delete the old folder**

```bash
git rm -r apps/web/src/components/soul/states/ExportState
```

- [ ] **Step 5: Full verification — typecheck, lint, full test suite**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

Run: `cd apps/web && npx eslint src/components/soul/export src/app/create/export`
Expected: no errors.

Run: `cd apps/web && npx vitest run`
Expected: all tests pass, including the new `export-phase.test.ts` and `useTrimHistory.test.ts`, plus the pre-existing `capture-phase.test.ts` and `useAudioTrimmer.test.ts`.

- [ ] **Step 6: Manual smoke check (state-exit rule)**

Start the dev server (`cd apps/web && npm run dev`), navigate to an export session, and confirm by hand:
- `preview` → tap Export → `exporting` shows progress fill and a working Cancel that returns to `preview`.
- A completed export shows the `ShareTakeover` with working variant pills and a working Download.
- Back button always opens `DiscardDialog`, and confirming it calls `onReset`.
- StyleSheet and EditSheet open/close correctly and their control changes reflect live on the canvas.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/create/export/[sessionId]/page.tsx apps/web/src/components/soul/index.ts
git commit -m "feat(export): switch to ExportScreen shell, remove legacy ExportState"
```

---

## Self-Review Notes

- **Spec coverage:** Shell/layout (Task 10), morphing dock (Task 8), floating sheets (Tasks 6–7), share takeover (Task 9), new folder + deletion of old (Tasks 10–11), unchanged business logic (Tasks 3, 10) — all five spec sections have a task.
- **Type consistency:** `ExportPhase` (Task 2) is the single source of truth consumed identically by `ExportDock`, `ExportHeader`, `ShareTakeover`'s visibility check, and `ExportScreen`. `UseTrimHistoryReturn` (Task 3) matches its usage in `EditSheet` (Task 7) and `ExportScreen` (Task 10) field-for-field.
- **Icon uncertainty:** `griddy-icons`' exact export name for an "edit/crop" glyph is unconfirmed — Task 8 Step 1 verifies this against the installed package before writing the import, rather than guessing.
- **Props contract:** Task 10's `ExportScreenProps` is a byte-for-byte copy of the old `ExportStateProps`, which is what makes Task 11 a pure import swap with no behavior change at the page level.
