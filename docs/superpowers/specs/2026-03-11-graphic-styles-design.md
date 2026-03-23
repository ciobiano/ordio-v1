# Graphic Styles — Design Spec

**Date:** 2026-03-11
**Status:** Approved

---

## Overview

The style selector expands from waveform-only to two categories: **Waveforms** (existing: bars, circle, spectrogram, none) and **Graphics** (new). Selecting a graphic style replaces the waveform entirely with a static SVG centred in the waveform zone. Captions appear below unchanged — same zone as waveform mode.

---

## Style Options

| Style ID | File | Appearance |
|---|---|---|
| `graphic-frame1` | `public/graphic-styles/frame1.svg` | Tinted with creator's `waveColor` (accent colour) |
| `graphic-frame2` | `public/graphic-styles/frame2.svg` | Rendered as-is (white fill in SVG) |

SVG assets live at `apps/web/public/graphic-styles/`. Already on disk. No changes needed to the files.

---

## Data Model

### Type definition

```ts
// Add to lib/store.ts (alongside WaveformVariant)
export type GraphicStyleId = 'graphic-frame1' | 'graphic-frame2' | null
```

`null` means a waveform style is active, not a graphic.

### Zustand store (`lib/store.ts`)

Add `graphicStyle` to `AppState` alongside `waveformStyle`:

```ts
// In AppState interface — add:
graphicStyle: GraphicStyleId
setGraphicStyle: (id: GraphicStyleId) => void
```

Add to `initialPreferences` (persisted to localStorage alongside `waveformStyle`):

```ts
graphicStyle: null as GraphicStyleId
```

Add to `partialize`:

```ts
graphicStyle: state.graphicStyle,
```

Add the setter action:

```ts
setGraphicStyle: (graphicStyle) => set({ graphicStyle }),
```

**Selection logic in the UI:** selecting a graphic calls `setGraphicStyle(id)` — `waveformStyle` is unchanged. Selecting a waveform calls `setGraphicStyle(null)`. The renderer checks `graphicStyle` first; a non-null value takes precedence over `waveformStyle`.

---

## Rendering (`lib/frameRenderer.ts`)

### `FrameOptions` — add `graphicStyle`

```ts
export interface FrameOptions {
  waveformData: number[];
  transcript: Word[];
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  captionStyle: CaptionVariant;
  showWatermark?: boolean;
  /** null = use waveform; non-null = render this graphic instead */
  graphicStyle?: GraphicStyleId;
}
```

### `renderFrame()` — replace the waveform block

Update the destructure to include `graphicStyle`, then replace step 2:

```ts
const { waveformData, transcript, style, waveformStyle, captionStyle, showWatermark, graphicStyle } = options;

// Step 2: visual zone — waveform or graphic
const shouldDrawWaveform = captionStyle !== 'karaoke' && waveformStyle !== 'none' && !graphicStyle;

if (graphicStyle) {
  const img = getGraphic(graphicStyle);
  if (img) drawGraphic(ctx, img, graphicStyle, style);
} else if (shouldDrawWaveform) {
  drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle);
}
```

### Caption layout when graphic is active

`drawCaptions()` uses `showWaveform` to decide caption Y position — `true` means "place above the waveform zone", `false` means "centre vertically". When a graphic is active, captions must still sit above the visual zone (spec: "Captions appear below unchanged — same zone as waveform mode").

Pass a separate `hasVisualZone` flag to caption functions:

```ts
// For caption positioning: treat graphic mode same as waveform mode
const hasVisualZone = captionStyle !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);

// Step 3: Captions
if (captionStyle === 'karaoke') {
  drawKaraokeCaptions(ctx, currentTime, transcript, style);
} else {
  drawCaptions(ctx, currentTime, transcript, style, captionStyle, hasVisualZone);
}
```

`drawCaptions()` signature: replace the `showWaveform` parameter with `hasVisualZone` (same type, same logic inside — just rename the parameter).

### `drawGraphic()`

The graphic is centred at the same vertical position the waveform occupies (`height * WAVEFORM_CENTER_Y`).

```ts
function drawGraphic(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  graphicStyle: NonNullable<GraphicStyleId>,
  style: StyleConfig
): void {
  const { width, height } = style;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Fit within 70% width, centred on waveform zone
  const maxW = width * 0.7;
  const maxH = height * 0.3;
  const fitByWidth = maxW / aspectRatio <= maxH;
  const drawW = fitByWidth ? maxW : maxH * aspectRatio;
  const drawH = fitByWidth ? maxW / aspectRatio : maxH;
  const drawX = (width - drawW) / 2;
  const drawY = height * WAVEFORM_CENTER_Y - drawH / 2;

  if (graphicStyle === 'graphic-frame1') {
    // Tint with creator's accent colour using OffscreenCanvas
    const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = style.waveColor;
    octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);
  } else {
    // frame2: draw as-is
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}
```

---

## Export Pipeline Propagation

`graphicStyle` must be threaded through three additional files:

### `lib/videoEncoder.ts`

Add `graphicStyle?: GraphicStyleId` to `EncodeVideoOptions`. In `encodeVideo()`, after `loadFont(style.fontFamily)`, add:

```ts
if (graphicStyle) {
  await loadGraphic(graphicStyle);
}
```

Pass `graphicStyle` through to each `renderFrame()` call in the frame loop.

### `lib/ffmpegEncoder.ts`

Same changes as `videoEncoder.ts` — add `graphicStyle` to `EncodeVideoOptions` (it re-exports or mirrors that type), load graphic before loop, pass through to `renderFrame()`.

### `hooks/useVideoExporter.ts`

Read `graphicStyle` from the store alongside `waveformStyle` and `captionStyle`, then forward it to `encodeVideo()`.

---

## SVG Pre-loading (`lib/graphicLoader.ts`)

Create a new file mirroring the `fontLoader.ts` cache pattern:

```ts
// lib/graphicLoader.ts
import type { GraphicStyleId } from '@/lib/store';

const cache = new Map<string, HTMLImageElement>();

export async function loadGraphic(id: NonNullable<GraphicStyleId>): Promise<HTMLImageElement> {
  if (cache.has(id)) return cache.get(id)!;
  const src = id === 'graphic-frame1' ? '/graphic-styles/frame1.svg' : '/graphic-styles/frame2.svg';
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

`loadGraphic()` is called during export initialisation (same timing as `loadFont()`) when `graphicStyle` is non-null. `getGraphic()` is called synchronously inside `renderFrame()` — it returns `null` if not yet loaded, which the renderer skips gracefully.

---

## UI — Style Selector

### File rename

`WaveformStyleSelector.tsx` → `StyleModeSelector.tsx`

**All import sites to update (rename only):**
- `apps/web/src/components/soul/WaveformStyleSelector.tsx` → rename file itself
- `apps/web/src/components/soul/index.ts` — update re-export
- `apps/web/src/app/page.tsx` — update import name

### `CanvasPreview.tsx`

Add `graphicStyle` prop and wire it through:

```ts
// CanvasPreviewProps — add:
graphicStyle?: GraphicStyleId;
```

Pre-load graphic when `graphicStyle` changes:
```ts
useEffect(() => {
  if (graphicStyle) loadGraphic(graphicStyle);
}, [graphicStyle]);
```

Pass to `frameOptions`:
```ts
const frameOptions: FrameOptions = {
  // existing fields...
  graphicStyle,
};
```

Update `useCallback` dependency array to include `graphicStyle`.

In `apps/web/src/app/page.tsx`, pass `graphicStyle={graphicStyle}` to `<CanvasPreview>`.

### Layout

The selector gains two sections in its expanded panel:

**Section 1 — Waveforms** (existing: Bars, Circle, Spectrum, None)
**Section 2 — Graphics** (new: Frame 1 (coloured), Frame 2 (white))

- Only one option is active at a time across both sections
- Selecting a graphic: `setGraphicStyle(id)` — waveformStyle unchanged
- Selecting a waveform: `setGraphicStyle(null)` — waveformStyle updated as before
- The collapsed pill shows the active option from whichever section is selected

### Active state display

When a graphic is active:
- Pill trigger shows a small SVG thumbnail icon (or a generic "graphic" icon) and the label ("Frame 1" / "Frame 2")
- Waveform options in the expanded panel appear unselected

---

## Feature Gating

Graphic styles are available on **all tiers**. No lock badge needed.

---

## Out of Scope

- Beat-driven frame animation (SVG is static)
- Custom SVG upload by creators (Phase D+, Pro feature)
- More than two built-in graphic styles at launch
- Changes to `packages/shared/src/schemas.ts` — `graphicStyle` is UI state, not shared schema
