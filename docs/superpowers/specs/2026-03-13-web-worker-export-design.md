# Web Worker Export Pipeline — Design Spec

## Problem

The video export pipeline (`encodeVideo` in `videoEncoder.ts`) runs entirely on the main thread. The synchronous `renderFrame()` loop blocks the UI for the full export duration — captions freeze, progress feels janky, and the preview canvas locks up. Additionally, Mediabunny is a static import (~400-600 KB) loaded on every page visit, even when users never export.

## Solution

Move the entire encoding pipeline (both WebCodecs/Mediabunny and ffmpeg.wasm paths) into a single Web Worker with its own `OffscreenCanvas`. The main thread becomes a thin orchestrator — it sends config and audio data in, receives progress and the final blob out.

## Architecture

### Message Protocol

**Main Thread → Worker:**

```typescript
// Start encoding
{
  type: 'start',
  payload: {
    audioChannels: Float32Array[],   // transferred (zero-copy)
    sampleRate: number,
    numberOfChannels: number,
    duration: number,
    transcript: Word[],
    style: StyleConfig,
    waveformStyle: WaveformVariant,
    captionStyle: CaptionVariant,
    graphicStyle: GraphicStyleId | undefined,
    showWatermark: boolean,
    useWebCodecs: boolean,           // detected on main thread
  }
}

// Cancel
{ type: 'abort' }
```

**Worker → Main Thread:**

```typescript
{ type: 'progress', value: number }   // 0–1
{ type: 'complete', blob: Blob }
{ type: 'error', message: string }
```

### Worker Internals (`export.worker.ts`)

```
onmessage('start')
  → create OffscreenCanvas(style.width, style.height)
  → get 2D context (OffscreenCanvasRenderingContext2D)
  → load fonts via workerFontLoader (FontFace + self.fonts.add)
  → load graphic SVG via fetch + createImageBitmap (if graphicStyle set)
  → wrap transferred Float32Arrays in AudioData-compatible object
  → compute waveformSampler() from wrapped audio data
  → branch on useWebCodecs:
      true  → dynamic import('mediabunny') → WebCodecs encode loop
      false → dynamic import('@ffmpeg/ffmpeg') → JPEG frame loop + transcode
  → each frame: renderFrame(ctx, i, totalFrames, frameOptions)
  → postMessage({ type: 'progress' }) per integer percent
  → postMessage({ type: 'complete', blob })
```

**Cancellation:** Worker checks an `aborted` flag each frame iteration. Main thread sends `{ type: 'abort' }` and calls `worker.terminate()` as a fallback.

### Type Widening: RenderContext

`OffscreenCanvas.getContext('2d')` returns `OffscreenCanvasRenderingContext2D`, which is a different TypeScript type from `CanvasRenderingContext2D`. Both types share the same drawing API surface (`fillRect`, `fillText`, `drawImage`, `measureText`, etc.), but TypeScript treats them as distinct.

**Solution:** Introduce a type alias and update all rendering function signatures:

```typescript
// In a shared types file (e.g., lib/types.ts)
export type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
```

**Files requiring signature updates (12 functions across 6 files):**

| File | Functions |
|------|-----------|
| `lib/frameRenderer.ts` | `renderFrame`, `drawGraphic`, `drawWaveform`, `drawCaptions`, `drawKaraokeCaptions`, `drawWatermark`, `wrapText` |
| `lib/waveforms/bars.ts` | `drawPillBars` |
| `lib/waveforms/circle.ts` | `drawCircleWaveform` |
| `lib/waveforms/spectrogram.ts` | `drawSpectrogram` |
| `lib/waveforms/constants.ts` | `drawPillRect`, `WaveformDrawFn` type |
| `lib/types.ts` | **New** — `RenderContext` type alias |

This is a mechanical change — no runtime behavior changes. Both context types support the same canvas drawing methods used in these functions.

### Graphic Loading: HTMLImageElement → ImageBitmap

`graphicLoader.ts` currently uses `new Image()` (`HTMLImageElement`), which is **not available in Workers**. The spec must migrate to `ImageBitmap`, which works in both main thread and Workers.

**Current (DOM-only):**
```typescript
const img = new Image();
img.src = '/graphic-styles/frame1.svg';
await img.onload;
cache.set(id, img);  // HTMLImageElement
```

**New (Worker-compatible):**
```typescript
const res = await fetch('/graphic-styles/frame1.svg');
const blob = await res.blob();
const bitmap = await createImageBitmap(blob);
cache.set(id, bitmap);  // ImageBitmap
```

**Impact on `frameRenderer.ts`:**
- `drawGraphic()` signature changes from `img: HTMLImageElement` to `img: ImageBitmap`
- `img.naturalWidth` / `img.naturalHeight` → `img.width` / `img.height` (ImageBitmap uses `.width`/`.height`)
- `ctx.drawImage(img, ...)` works unchanged — `drawImage` accepts `ImageBitmap`
- `OffscreenCanvas` tinting in `drawGraphic` already works (it creates a new `OffscreenCanvas` internally)

**CanvasPreview on main thread:** `ImageBitmap` also works with `CanvasRenderingContext2D.drawImage()`, so the preview canvas is unaffected.

### Font Loading: Worker-Compatible Strategy

`fontLoader.ts` currently relies on DOM APIs (`document.fonts`, `document.createElement('link')`, `document.head.appendChild`), **none of which exist in Workers**.

**Strategy: Isomorphic font loader with environment detection.**

| Font type | Main thread (current) | Worker (new) |
|-----------|----------------------|--------------|
| Local (Geist) | `FontFace` + `document.fonts.add()` | `FontFace` + `self.fonts.add()` — same pattern, different global |
| Google Fonts (Inter, Roboto, Outfit) | Inject `<link>` tag + `document.fonts.load()` | Fetch Google Fonts CSS → parse `.woff2` URLs → fetch binary → `FontFace(name, binaryData)` → `self.fonts.add()` |

The Google Fonts Worker path is new logic:
1. `fetch('https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap')` with a browser-like `User-Agent` header (Google returns `.woff2` URLs only for modern UAs)
2. Parse the CSS response to extract `src: url(...)` for each `@font-face` block
3. `fetch()` each `.woff2` URL → `arrayBuffer()`
4. `new FontFace('Inter', arrayBuffer, { weight: '600' })` → `await face.load()` → `self.fonts.add(face)`

**Implementation:** Create `lib/workerFontLoader.ts` — a Worker-specific font loader. The main-thread `fontLoader.ts` stays unchanged (used by `CanvasPreview`). The Worker imports only `workerFontLoader`.

### Audio Data Transfer & Reconstruction

`AudioBuffer` is not structured-cloneable. The main thread extracts raw channel data:

```typescript
const channels: Float32Array[] = [];
for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
  channels.push(audioBuffer.getChannelData(i));
}
// Transfer (zero-copy) via Transferable list
worker.postMessage(
  { type: 'start', payload: { audioChannels: channels, ... } },
  channels.map(c => c.buffer)
);
```

**Important:** After transfer, the original `Float32Array` buffers become **detached** (zero-length) on the main thread. Any main-thread code reading `audioBuffer.getChannelData()` after calling `startExport` will get empty arrays. The `audioBuffer` effectively becomes unusable. This is acceptable because export is a terminal action — the user downloads the result.

**Inside the Worker — AudioData wrapper for waveformSampler:**

`waveformSampler()` accepts an `AudioData` interface (`{ length, sampleRate, numberOfChannels, getChannelData }`), not raw `Float32Array[]`. The Worker wraps the transferred arrays:

```typescript
const audioData: AudioData = {
  length: audioChannels[0].length,
  sampleRate,
  numberOfChannels,
  getChannelData: (ch: number) => audioChannels[ch],
};
const waveformData = waveformSampler(audioData, 200);
```

**For Mediabunny's `AudioBufferSource`:** Requires an `AudioBuffer`. Construct via `OfflineAudioContext` (available in Workers):

```typescript
const offlineCtx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
const buffer = offlineCtx.createBuffer(numberOfChannels, length, sampleRate);
for (let ch = 0; ch < numberOfChannels; ch++) {
  buffer.copyToChannel(audioChannels[ch], ch);
}
```

If `OfflineAudioContext` is unavailable in the Worker, fall through to the ffmpeg.wasm path (which encodes WAV from raw PCM directly, no `AudioBuffer` needed).

### Mediabunny + OffscreenCanvas Compatibility

`CanvasSource` in Mediabunny currently receives a canvas element. If it does not accept `OffscreenCanvas`:

**Fallback plan:** Replace `CanvasSource` with raw WebCodecs `VideoEncoder` + `mp4-muxer` (~15 KB). The flow becomes:
1. `renderFrame()` → OffscreenCanvas
2. `new VideoFrame(offscreenCanvas, { timestamp })` → feed to `VideoEncoder`
3. `VideoEncoder` output → `mp4-muxer` → final MP4 blob

The Worker architecture remains identical regardless of which muxing approach is used.

### Main Thread Integration (`useVideoExporter`)

The hook's public API changes minimally:

```typescript
interface UseVideoExporterReturn {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}
```

**Change:** `canvas: HTMLCanvasElement` parameter removed from `startExport` — the Worker creates its own `OffscreenCanvas`. The canvas was only used for encoding; the preview canvas is managed separately by `CanvasPreview.tsx`.

Internally, `startExport` becomes:
1. Detect WebCodecs support (`hasWebCodecsSupport()`)
2. Extract `Float32Array` channels from `AudioBuffer`
3. Spawn Worker: `new Worker(new URL('./export.worker.ts', import.meta.url))`
4. Transfer audio data + config via `postMessage`
5. Listen for `progress` → `setExportProgress()`
6. Listen for `complete` → `URL.createObjectURL(blob)` → `setExportedUrl()`
7. Listen for `error` → `setError()`

`cancelExport` sends `{ type: 'abort' }` then calls `worker.terminate()`.

**Note:** `hasWebCodecsSupport()` and `fileExtension()` remain exported from `useVideoExporter.ts` (or a shared utils file) since they're used by the main thread.

## What Changes

| File | Change |
|------|--------|
| `lib/export.worker.ts` | **New** — Worker entry point, owns encoding pipeline |
| `lib/workerFontLoader.ts` | **New** — Worker-compatible font loading (fetch CSS → parse woff2 → FontFace) |
| `lib/types.ts` | **New** — `RenderContext` type alias |
| `hooks/useVideoExporter.ts` | **Rewrite** — spawn Worker, remove `canvas` param from `startExport` |
| `lib/graphicLoader.ts` | **Rewrite** — `HTMLImageElement` → `ImageBitmap` via `fetch` + `createImageBitmap` |
| `lib/frameRenderer.ts` | **Update** — `CanvasRenderingContext2D` → `RenderContext`, `drawGraphic` takes `ImageBitmap` |
| `lib/waveforms/bars.ts` | **Update** — `CanvasRenderingContext2D` → `RenderContext` |
| `lib/waveforms/circle.ts` | **Update** — `CanvasRenderingContext2D` → `RenderContext` |
| `lib/waveforms/spectrogram.ts` | **Update** — `CanvasRenderingContext2D` → `RenderContext` |
| `lib/waveforms/constants.ts` | **Update** — `drawPillRect` + `WaveformDrawFn` type → `RenderContext` |
| `lib/videoEncoder.ts` | **Delete** — logic moves into Worker (remove dead `QUALITY_HIGH`/`QUALITY_MEDIUM` imports) |
| `lib/ffmpegEncoder.ts` | **Delete** — logic moves into Worker |
| `app/page.tsx` | **Minor update** — remove `createInitializedCanvas` call, drop `canvas` arg from `startExport` |

## What Does NOT Change

- `useVideoExporter` return interface shape (same fields)
- `CanvasPreview.tsx` — keeps rendering on main thread with its own canvas
- `renderFrame()` logic — pure function, same drawing code
- `fontLoader.ts` — main-thread font loader stays for `CanvasPreview`
- Store shape, transcript format, style types

## Bundle Impact

| | Before | After |
|---|--------|-------|
| Main JS | Includes mediabunny (~400-600 KB) | App code only |
| Encoder code | Loaded on page visit | Loaded on-demand in Worker |
| ffmpeg.wasm | Already lazy | Still lazy, inside Worker |
| Initial page load | Heavier | Lighter |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mediabunny `CanvasSource` rejects `OffscreenCanvas` | Fall back to raw `VideoEncoder` + `mp4-muxer` |
| `FontFace` API unavailable in some Worker contexts | Feature-detect; fall back to default font (Inter via system) |
| `OfflineAudioContext` unavailable in Worker | Fall through to ffmpeg.wasm path (encodes WAV from raw PCM) |
| Next.js Worker bundling quirks | Use `new URL('./worker.ts', import.meta.url)` pattern (webpack 5 native) |
| Google Fonts CSS parsing fragility | Parse conservatively; cache parsed URLs; fall back to local fonts on failure |
| Transferred `Float32Array` detaches on main thread | Acceptable — export is terminal action; document in code comments |

## Success Criteria

- UI remains fully responsive during export (preview animates, buttons respond)
- Export produces identical MP4 output (same quality, same codec settings)
- Main bundle size decreases (mediabunny no longer in initial load)
- Both WebCodecs and ffmpeg.wasm paths work from the Worker
- Cancellation works (stops encoding, cleans up Worker)
- Progress reporting is smooth (1% granularity)
- All existing frameRenderer tests pass with `RenderContext` type
