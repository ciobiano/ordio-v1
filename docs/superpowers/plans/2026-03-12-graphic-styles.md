# Graphic Styles Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two static SVG graphic styles (frame1 accent-tinted, frame2 white) to the style selector as peers to waveforms — selecting a graphic replaces the waveform in exported video and canvas preview for all tiers.

**Architecture:** New `GraphicStyleId` type in the Zustand store alongside `WaveformVariant`; new `graphicLoader.ts` for SVG caching; `FrameOptions` gains `graphicStyle`; `renderFrame()` branches on graphic vs waveform and uses `hasVisualZone` for caption layout; `graphicStyle` is threaded through both encoders, `useVideoExporter`, and `CanvasPreview`; `WaveformStyleSelector.tsx` is renamed `StyleModeSelector.tsx` and gains a Graphics section.

**Tech Stack:** Zustand, Canvas 2D API, OffscreenCanvas (SVG tinting), SVG as HTMLImageElement

---

## Chunk 1: Data Layer

### Task 1: Add GraphicStyleId + graphicStyle to store

**Files:**
- Modify: `apps/web/src/lib/store.ts`
- Create: `apps/web/src/__tests__/store-graphicStyle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/store-graphicStyle.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';

describe('graphicStyle store', () => {
  beforeEach(() => {
    useStore.setState({ graphicStyle: null });
  });

  it('defaults to null', () => {
    expect(useStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle updates graphicStyle', () => {
    useStore.getState().setGraphicStyle('graphic-frame1');
    expect(useStore.getState().graphicStyle).toBe('graphic-frame1');
  });

  it('setGraphicStyle accepts null to return to waveform mode', () => {
    useStore.getState().setGraphicStyle('graphic-frame1');
    useStore.getState().setGraphicStyle(null);
    expect(useStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle accepts graphic-frame2', () => {
    useStore.getState().setGraphicStyle('graphic-frame2');
    expect(useStore.getState().graphicStyle).toBe('graphic-frame2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter=web vitest run src/__tests__/store-graphicStyle.test.ts
```

Expected: FAIL — `graphicStyle` is not defined on store

- [ ] **Step 3: Implement in store.ts**

In `apps/web/src/lib/store.ts`, make these additions:

**After the `WaveformVariant` type export, add:**
```ts
export type GraphicStyleId = 'graphic-frame1' | 'graphic-frame2' | null;
```

**In the `AppState` interface, after `waveformStyle: WaveformVariant`, add:**
```ts
graphicStyle: GraphicStyleId;
setGraphicStyle: (id: GraphicStyleId) => void;
```

**In `initialPreferences`, after `waveformStyle: 'bars' as WaveformVariant`, add:**
```ts
graphicStyle: null as GraphicStyleId,
```

**In `partialize`, after `waveformStyle: state.waveformStyle`, add:**
```ts
graphicStyle: state.graphicStyle,
```

**In the `create()` call, after `setWaveformStyle: (waveformStyle) => set({ waveformStyle }),` add:**
```ts
setGraphicStyle: (graphicStyle) => set({ graphicStyle }),
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter=web vitest run src/__tests__/store-graphicStyle.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/store.ts apps/web/src/__tests__/store-graphicStyle.test.ts
git commit -m "feat(store): add GraphicStyleId type and graphicStyle state"
```

---

### Task 2: Create graphicLoader.ts

**Files:**
- Create: `apps/web/src/lib/graphicLoader.ts`
- Create: `apps/web/src/__tests__/graphicLoader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/graphicLoader.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Note: graphicLoader uses a module-level cache. Use vi.resetModules() to clear between tests.

describe('graphicLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('loadGraphic resolves with an HTMLImageElement for graphic-frame1', async () => {
    // Mock Image to auto-trigger onload
    vi.spyOn(globalThis, 'Image' as never).mockImplementation((): HTMLImageElement => {
      const img = { src: '', onload: null as (() => void) | null, onerror: null as (() => void) | null, naturalWidth: 340, naturalHeight: 355 };
      setTimeout(() => img.onload?.(), 0);
      return img as unknown as HTMLImageElement;
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame1');
    expect(img).toBeDefined();
    expect(img.src).toContain('frame1.svg');
  });

  it('loadGraphic resolves for graphic-frame2', async () => {
    vi.spyOn(globalThis, 'Image' as never).mockImplementation((): HTMLImageElement => {
      const img = { src: '', onload: null as (() => void) | null, onerror: null as (() => void) | null, naturalWidth: 321, naturalHeight: 189 };
      setTimeout(() => img.onload?.(), 0);
      return img as unknown as HTMLImageElement;
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame2');
    expect(img.src).toContain('frame2.svg');
  });

  it('loadGraphic rejects on load error', async () => {
    vi.spyOn(globalThis, 'Image' as never).mockImplementation((): HTMLImageElement => {
      const img = { src: '', onload: null as (() => void) | null, onerror: null as (() => void) | null };
      setTimeout(() => img.onerror?.(), 0);
      return img as unknown as HTMLImageElement;
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    await expect(loadGraphic('graphic-frame1')).rejects.toThrow('Failed to load graphic');
  });

  it('getGraphic returns null before any load', async () => {
    const { getGraphic } = await import('@/lib/graphicLoader');
    expect(getGraphic('graphic-frame1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter=web vitest run src/__tests__/graphicLoader.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement graphicLoader.ts**

Create `apps/web/src/lib/graphicLoader.ts`:

```ts
import type { GraphicStyleId } from '@/lib/store';

const cache = new Map<string, HTMLImageElement>();

export async function loadGraphic(id: NonNullable<GraphicStyleId>): Promise<HTMLImageElement> {
  if (cache.has(id)) return cache.get(id)!;

  const src = id === 'graphic-frame1'
    ? '/graphic-styles/frame1.svg'
    : '/graphic-styles/frame2.svg';

  const img = new Image();
  img.src = src;

  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Failed to load graphic: ${id}`));
  });

  cache.set(id, img);
  return img;
}

export function getGraphic(id: NonNullable<GraphicStyleId>): HTMLImageElement | null {
  return cache.get(id) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter=web vitest run src/__tests__/graphicLoader.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/graphicLoader.ts apps/web/src/__tests__/graphicLoader.test.ts
git commit -m "feat(graphicLoader): SVG pre-load cache with loadGraphic + getGraphic"
```

---

## Chunk 2: Rendering

### Task 3: Update frameRenderer.ts — FrameOptions + renderFrame() branch

**Files:**
- Modify: `apps/web/src/lib/frameRenderer.ts`
- Modify: `apps/web/src/__tests__/frameRenderer.test.ts`

- [ ] **Step 1: Add OffscreenCanvas mock to test setup**

In `apps/web/src/__tests__/setup.ts`, add at the bottom:

```ts
// Mock OffscreenCanvas for drawGraphic tests (not available in jsdom)
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  (globalThis as Record<string, unknown>).OffscreenCanvas = class {
    constructor(public width: number, public height: number) {}
    getContext() {
      const calls: Array<{ method: string; args: unknown[] }> = [];
      return new Proxy({} as Record<string, unknown>, {
        get: (_t, p: string) => {
          if (p === '__calls') return calls;
          return (...a: unknown[]) => calls.push({ method: String(p), args: a });
        },
        set: (_t, p: string, v: unknown) => {
          calls.push({ method: `set:${String(p)}`, args: [v] });
          return true;
        },
      });
    }
  };
}
```

- [ ] **Step 2: Write failing tests in frameRenderer.test.ts**

Add these tests to the `describe('renderFrame', ...)` block:

```ts
it('renders without crashing when graphicStyle is set', () => {
  const ctx = createMockCtx();
  expect(() =>
    renderFrame(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame1' }))
  ).not.toThrow();
});

it('does not call waveform drawing when graphicStyle is set', () => {
  // The waveforms use specific canvas calls. With a graphic set and no cached
  // image, the renderer should skip the waveform entirely.
  const ctx = createMockCtx();
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

  // No image in cache — getGraphic returns null — so drawImage is not called
  renderFrame(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame1', waveformStyle: 'bars' }));
  expect(calls.some(c => c.method === 'drawImage')).toBe(false);
});

it('captions still render when graphicStyle is set', () => {
  const ctx = createMockCtx();
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

  renderFrame(ctx, 15, 90, makeOptions({ graphicStyle: 'graphic-frame1' }));

  const fillTextCalls = calls.filter(c => c.method === 'fillText');
  expect(fillTextCalls.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
```

Expected: FAIL on the new tests — `graphicStyle` not in `FrameOptions`

- [ ] **Step 4: Implement changes in frameRenderer.ts**

**At the top of the file, add imports:**
```ts
import type { GraphicStyleId } from '@/lib/store';
import { getGraphic } from '@/lib/graphicLoader';
```

**In `FrameOptions` interface, add after `showWatermark`:**
```ts
/** null = use waveform; non-null = render this SVG graphic instead */
graphicStyle?: GraphicStyleId;
```

**In `renderFrame()`, update the destructure line to:**
```ts
const { waveformData, transcript, style, waveformStyle, captionStyle, showWatermark, graphicStyle } = options;
```

**Replace steps 2 and 3 in `renderFrame()` with:**
```ts
// 2. Visual zone — graphic or waveform
const shouldDrawWaveform = captionStyle !== 'karaoke' && waveformStyle !== 'none' && !graphicStyle;

if (graphicStyle) {
  const img = getGraphic(graphicStyle);
  if (img) drawGraphic(ctx, img, graphicStyle, style);
} else if (shouldDrawWaveform) {
  drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle);
}

// 3. Captions — hasVisualZone keeps captions above graphic same as above waveform
const hasVisualZone = captionStyle !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
if (captionStyle === 'karaoke') {
  drawKaraokeCaptions(ctx, currentTime, transcript, style);
} else {
  drawCaptions(ctx, currentTime, transcript, style, captionStyle, hasVisualZone);
}
```

**In `drawCaptions()` signature, rename the last parameter from `showWaveform` to `hasVisualZone`** (same type — `boolean` — same logic inside, just a rename):
```ts
function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  captionStyle: CaptionVariant,
  hasVisualZone: boolean   // renamed from showWaveform
): void {
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
```

Expected: PASS — all existing + 3 new tests

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/frameRenderer.ts apps/web/src/__tests__/frameRenderer.test.ts apps/web/src/__tests__/setup.ts
git commit -m "feat(renderer): add graphicStyle to FrameOptions, branch waveform/graphic in renderFrame"
```

---

### Task 4: Add drawGraphic() to frameRenderer.ts

**Files:**
- Modify: `apps/web/src/lib/frameRenderer.ts`
- Modify: `apps/web/src/__tests__/frameRenderer.test.ts`

- [ ] **Step 1: Write a failing test using a mocked cached image**

Add to `frameRenderer.test.ts`:

```ts
it('calls ctx.drawImage when graphicStyle is set and image is in cache', async () => {
  // vi.mock() is hoisted — use vi.doMock() + vi.resetModules() + dynamic import instead
  vi.resetModules();
  vi.doMock('@/lib/graphicLoader', () => ({
    getGraphic: () => Object.assign(new EventTarget(), {
      src: '/graphic-styles/frame2.svg',
      naturalWidth: 321,
      naturalHeight: 189,
    }) as unknown as HTMLImageElement,
    loadGraphic: vi.fn(),
  }));

  const { renderFrame: renderFrameFresh } = await import('@/lib/frameRenderer');
  const ctx = createMockCtx();
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

  renderFrameFresh(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame2' }));

  // direct path (frame2): ctx.drawImage(img, x, y, w, h) is called
  expect(calls.some(c => c.method === 'drawImage')).toBe(true);

  vi.resetModules();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
```

Expected: FAIL — test assertion `expect(calls.some(c => c.method === 'drawImage')).toBe(true)` fails because `drawGraphic()` doesn't exist yet, so `getGraphic()` result is never used

- [ ] **Step 3: Implement drawGraphic() in frameRenderer.ts**

Add this function after the `drawWaveform()` dispatch function:

```ts
// ── Graphic Drawing ──────────────────────────────────────────────────

function drawGraphic(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  graphicStyle: NonNullable<GraphicStyleId>,
  style: StyleConfig
): void {
  const { width, height } = style;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Fit within 70% width and 30% height, preserving aspect ratio
  const maxW = width * 0.7;
  const maxH = height * 0.3;
  const fitByWidth = maxW / aspectRatio <= maxH;
  const drawW = fitByWidth ? maxW : maxH * aspectRatio;
  const drawH = fitByWidth ? maxW / aspectRatio : maxH;

  // Centre horizontally; vertically centred on the waveform zone
  const drawX = (width - drawW) / 2;
  const drawY = height * WAVEFORM_CENTER_Y - drawH / 2;

  if (graphicStyle === 'graphic-frame1') {
    // Tint with creator's accent colour (waveColor) via OffscreenCanvas
    const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = style.waveColor;
    octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);
  } else {
    // graphic-frame2: draw as-is (white fill in SVG)
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
```

Expected: PASS — all tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/frameRenderer.ts apps/web/src/__tests__/frameRenderer.test.ts
git commit -m "feat(renderer): add drawGraphic with OffscreenCanvas accent tinting for frame1"
```

---

## Chunk 3: Export Pipeline + UI

### Task 5: Thread graphicStyle through videoEncoder.ts

**Files:**
- Modify: `apps/web/src/lib/videoEncoder.ts`

- [ ] **Step 1: Add graphicStyle to EncodeVideoOptions**

In `apps/web/src/lib/videoEncoder.ts`, add to the imports at the top:
```ts
import type { GraphicStyleId } from '@/lib/store';
import { loadGraphic } from '@/lib/graphicLoader';
```

In `EncodeVideoOptions`, add after `showWatermark`:
```ts
/** Graphic style to render — null or undefined = use waveform */
graphicStyle?: GraphicStyleId;
```

- [ ] **Step 2: Add load + pass-through in encodeVideo()**

In the `encodeVideo()` function:

Update the destructure (line ~54) to include `graphicStyle`:
```ts
const { canvas, audioBuffer, transcript, style, waveformStyle, captionStyle, showWatermark, graphicStyle, onProgress, signal } = options;
```

After `await loadFont(style.fontFamily);` (line ~67), add:
```ts
if (graphicStyle) await loadGraphic(graphicStyle);
```

In the `frameOptions` object (line ~111), add `graphicStyle`:
```ts
const frameOptions: FrameOptions = {
  waveformData,
  transcript,
  style,
  waveformStyle,
  captionStyle,
  showWatermark,
  graphicStyle,
};
```

- [ ] **Step 3: Run type check**

```bash
pnpm type-check
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/videoEncoder.ts
git commit -m "feat(encoder): thread graphicStyle through encodeVideo"
```

---

### Task 6: Thread graphicStyle through ffmpegEncoder.ts

**Files:**
- Modify: `apps/web/src/lib/ffmpegEncoder.ts`

`ffmpegEncoder` imports `EncodeVideoOptions` from `videoEncoder` — so the type is already updated. Only the runtime wiring needs adding.

- [ ] **Step 1: Add import + destructure + load + pass-through**

In `apps/web/src/lib/ffmpegEncoder.ts`, add to imports:
```ts
import { loadGraphic } from '@/lib/graphicLoader';
```

In `encodeVideoFFmpeg()`, update the destructure to include `graphicStyle`:
```ts
const { canvas, audioBuffer, transcript, style, waveformStyle, captionStyle, showWatermark, graphicStyle, onProgress, signal } = options;
```

After `await loadFont(style.fontFamily);` (line ~40), add:
```ts
if (graphicStyle) await loadGraphic(graphicStyle);
```

In the `frameOptions` object (line ~53), add `graphicStyle`:
```ts
const frameOptions: FrameOptions = {
  waveformData,
  transcript,
  style,
  waveformStyle,
  captionStyle,
  showWatermark,
  graphicStyle,
};
```

- [ ] **Step 2: Run type check**

```bash
pnpm type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ffmpegEncoder.ts
git commit -m "feat(ffmpeg-encoder): thread graphicStyle through ffmpeg encode path"
```

---

### Task 7: Read graphicStyle in useVideoExporter.ts

**Files:**
- Modify: `apps/web/src/hooks/useVideoExporter.ts`

- [ ] **Step 1: Read from store + forward to encoder**

In `apps/web/src/hooks/useVideoExporter.ts`, in the `startExport` callback, update the store read line:

```ts
// Before:
const { transcript, style, waveformStyle, captionStyle } = useStore.getState();

// After:
const { transcript, style, waveformStyle, captionStyle, graphicStyle } = useStore.getState();
```

Add `graphicStyle` to the `encode()` call:
```ts
const result = await encode({
  canvas,
  audioBuffer,
  transcript,
  style,
  waveformStyle,
  captionStyle,
  showWatermark,
  graphicStyle,
  onProgress: (progress) => setExportProgress(progress * 100),
  signal: abortController.signal,
});
```

- [ ] **Step 2: Run type check**

```bash
pnpm type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useVideoExporter.ts
git commit -m "feat(exporter): read and forward graphicStyle from store to encoder"
```

---

### Task 8: Add graphicStyle prop to CanvasPreview.tsx

**Files:**
- Modify: `apps/web/src/components/primitives/CanvasPreview.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `CanvasPreview.tsx`:
```ts
import type { GraphicStyleId } from '@/lib/store';
import { loadGraphic } from '@/lib/graphicLoader';
```

- [ ] **Step 2: Add graphicStyle to props**

In `CanvasPreviewProps`, add after `showWatermark`:
```ts
graphicStyle?: GraphicStyleId;
```

- [ ] **Step 3: Destructure in component function**

Add `graphicStyle` to the destructured props in `export default function CanvasPreview(...)`.

- [ ] **Step 4: Pre-load graphic on change**

Add a new `useEffect` (after the existing font loading effect):
```ts
useEffect(() => {
  if (graphicStyle) loadGraphic(graphicStyle);
}, [graphicStyle]);
```

- [ ] **Step 5: Pass graphicStyle into frameOptions**

In the `frameOptions` object inside `drawCurrentFrame`, add:
```ts
const frameOptions: FrameOptions = {
  waveformData: waveformDataRef.current,
  transcript,
  style: { ...style, width: canvasWidth, height: canvasHeight },
  waveformStyle,
  captionStyle,
  showWatermark,
  graphicStyle,
};
```

- [ ] **Step 6: Add graphicStyle to useCallback dependency array**

```ts
}, [playback.currentTime, playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionStyle, showWatermark, graphicStyle, fontLoaded]);
```

- [ ] **Step 7: Run type check**

```bash
pnpm type-check
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/primitives/CanvasPreview.tsx
git commit -m "feat(canvas-preview): add graphicStyle prop, pre-load SVG, pass to renderFrame"
```

---

### Task 9: Rename WaveformStyleSelector → StyleModeSelector

**Files:**
- Rename: `apps/web/src/components/soul/WaveformStyleSelector.tsx` → `StyleModeSelector.tsx`
- Modify: `apps/web/src/components/soul/index.ts`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Git rename the file**

```bash
git mv apps/web/src/components/soul/WaveformStyleSelector.tsx apps/web/src/components/soul/StyleModeSelector.tsx
```

- [ ] **Step 2: Update the component name inside the file**

In `apps/web/src/components/soul/StyleModeSelector.tsx`:
- Rename `WaveformStyleSelectorProps` → `StyleModeSelectorProps`
- Rename `export default function WaveformStyleSelector` → `export default function StyleModeSelector`

- [ ] **Step 3: Update index.ts**

In `apps/web/src/components/soul/index.ts`, change:
```ts
// Before:
export { default as WaveformStyleSelector } from './WaveformStyleSelector';

// After:
export { default as StyleModeSelector } from './StyleModeSelector';
```

- [ ] **Step 4: Update page.tsx import and usage**

In `apps/web/src/app/page.tsx`:
- Find the import of `WaveformStyleSelector` from soul components — change to `StyleModeSelector`
- Find the JSX `<WaveformStyleSelector ... />` — change to `<StyleModeSelector ... />`

- [ ] **Step 5: Run type check**

```bash
pnpm type-check
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/soul/StyleModeSelector.tsx apps/web/src/components/soul/index.ts apps/web/src/app/page.tsx
git commit -m "refactor(ui): rename WaveformStyleSelector to StyleModeSelector"
```

---

### Task 10: Extend StyleModeSelector with Graphics section

**Files:**
- Modify: `apps/web/src/components/soul/StyleModeSelector.tsx`

- [ ] **Step 1: Add store imports and graphic data**

At the top of `StyleModeSelector.tsx`, add to the store import:
```ts
import { useStore, type WaveformVariant, type GraphicStyleId } from '@/lib/store';
```

Add after the existing `labels` object:

```ts
type GraphicVariant = NonNullable<GraphicStyleId>;

const graphicVariants: GraphicVariant[] = ['graphic-frame1', 'graphic-frame2'];

const graphicLabels: Record<GraphicVariant, string> = {
  'graphic-frame1': 'Frame 1',
  'graphic-frame2': 'Frame 2',
};
```

- [ ] **Step 2: Add a graphic icon**

Add after the existing `NoneIcon` function:

```tsx
function GraphicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <rect x="1" y="2" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 9l4-3 3 2.5 3-3.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Read graphicStyle from store**

In the component body, add alongside the existing store reads:
```ts
const graphicStyle = useStore((s) => s.graphicStyle);
const setGraphicStyle = useStore((s) => s.setGraphicStyle);
```

- [ ] **Step 4: Update the collapsed pill trigger**

Replace the existing `const ActiveIcon = icons[waveformStyle];` line and the trigger `<button>` block with:

```tsx
const activeIsGraphic = graphicStyle !== null;
const ActiveIcon = activeIsGraphic ? GraphicIcon : icons[waveformStyle];
const activeLabel = activeIsGraphic ? graphicLabels[graphicStyle!] : labels[waveformStyle];
```

Then replace the trigger `<button>` JSX (keep all existing class names and refs, only update the label/icon references):

```tsx
<button
  ref={triggerRef}
  onClick={() => setOpen((o) => !o)}
  className={cn(
    'min-h-11 px-3 py-2 rounded-xl flex items-center gap-2',
    'bg-white/5 border border-white/10 backdrop-blur-md',
    'hover:bg-white/10 hover:border-white/20 transition-all duration-150',
    'cursor-pointer select-none'
  )}
  aria-expanded={open}
  aria-haspopup="true"
  aria-label={`Style: ${activeLabel}. Tap to change.`}
>
  <span className="text-white/60">
    <ActiveIcon />
  </span>
  <span className="text-white/60 text-xs font-medium tracking-wide">
    {activeLabel}
  </span>
  <ChevronIcon open={open} />
</button>
```

- [ ] **Step 5: Add Graphics section to the expanded panel**

In the expanded options panel, after the existing waveform buttons loop, add a divider and the graphics section:

```tsx
{/* Divider */}
<div className="w-px h-6 bg-white/10 mx-0.5" aria-hidden="true" />

{/* Graphics section */}
{graphicVariants.map((variant) => {
  const isActive = graphicStyle === variant;
  return (
    <button
      key={variant}
      onClick={() => {
        setGraphicStyle(variant);
        setOpen(false);
        setTimeout(() => triggerRef.current?.focus(), 0);
      }}
      aria-label={`${graphicLabels[variant]} graphic style`}
      aria-pressed={isActive}
      className={cn(
        'min-w-11 min-h-11 rounded-lg flex flex-col items-center justify-center gap-0.5',
        'transition-all duration-150 cursor-pointer border',
        isActive
          ? 'bg-white/20 border-white/40 text-white/90'
          : 'bg-transparent border-transparent text-white/60 hover:bg-white/10 hover:text-white/80'
      )}
    >
      <GraphicIcon />
      <span className="text-[9px] font-medium tracking-wide leading-none">{graphicLabels[variant]}</span>
    </button>
  );
})}
```

- [ ] **Step 6: Clear graphicStyle when a waveform is selected**

In the existing waveform button `onClick`, add `setGraphicStyle(null)`:
```tsx
onClick={() => {
  setWaveformStyle(variant);
  setGraphicStyle(null);   // ← add this
  setOpen(false);
  setTimeout(() => triggerRef.current?.focus(), 0);
}}
```

- [ ] **Step 7: Run type check**

```bash
pnpm type-check
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/soul/StyleModeSelector.tsx
git commit -m "feat(ui): extend StyleModeSelector with Graphics section — frame1 (tinted), frame2 (white)"
```

---

### Task 11: Pass graphicStyle to CanvasPreview from page.tsx

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Read graphicStyle from store in page.tsx**

Find where `waveformStyle` and `captionStyle` are read from the store in `page.tsx`. Add `graphicStyle` to that same read:
```ts
const graphicStyle = useStore((s) => s.graphicStyle);
```

- [ ] **Step 2: Pass graphicStyle to CanvasPreview**

Find the `<CanvasPreview ... />` JSX and add the prop:
```tsx
<CanvasPreview
  ...
  graphicStyle={graphicStyle}
/>
```

- [ ] **Step 3: Run type check + full test suite**

```bash
pnpm type-check
pnpm --filter=web test
```

Expected: no TypeScript errors, all tests pass

- [ ] **Step 4: Final commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(page): pass graphicStyle to CanvasPreview"
```
