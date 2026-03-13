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
  → get 2D context
  → load font via FontFace API (available in Workers)
  → load graphic SVG via fetch (if graphicStyle set)
  → reconstruct audio data from transferred Float32Arrays
  → compute waveformSampler() from channel data
  → branch on useWebCodecs:
      true  → dynamic import('mediabunny') → WebCodecs encode loop
      false → dynamic import('@ffmpeg/ffmpeg') → JPEG frame loop + transcode
  → each frame: renderFrame(ctx, i, totalFrames, frameOptions)
  → postMessage({ type: 'progress' }) per integer percent
  → postMessage({ type: 'complete', blob })
```

**Cancellation:** Worker checks an `aborted` flag each frame iteration. Main thread sends `{ type: 'abort' }` and calls `worker.terminate()` as a fallback.

### Font Loading in Workers

The `FontFace` constructor and `self.fonts.add()` are available in Worker contexts. The Worker fetches font files by URL (same mechanism as `fontLoader.ts`) and registers them on the Worker's font set. The 2D canvas context in the Worker then resolves font families normally.

### Audio Data Transfer

`AudioBuffer` is not structured-cloneable. The main thread extracts raw channel data:

```typescript
const channels: Float32Array[] = [];
for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
  channels.push(audioBuffer.getChannelData(i));
}
// Transfer (zero-copy) via Transferable list
worker.postMessage({ type: 'start', payload: { audioChannels: channels, ... } }, channels.map(c => c.buffer));
```

Inside the Worker, audio data is reconstructed:
- For waveform sampling: use raw Float32Arrays directly (waveformSampler accepts channel data)
- For Mediabunny's `AudioBufferSource`: construct via `OfflineAudioContext` (available in Workers)
- For ffmpeg.wasm: encode Float32Arrays to WAV format (existing pattern in `ffmpegEncoder.ts`)

### Mediabunny + OffscreenCanvas Compatibility

`CanvasSource` in Mediabunny currently receives a canvas element. If it does not accept `OffscreenCanvas`:

**Fallback plan:** Replace `CanvasSource` with raw WebCodecs `VideoEncoder` + `mp4-muxer` (~15 KB). The flow becomes:
1. `renderFrame()` → OffscreenCanvas
2. `new VideoFrame(offscreenCanvas, { timestamp })` → feed to `VideoEncoder`
3. `VideoEncoder` output → `mp4-muxer` → final MP4 blob

The Worker architecture remains identical regardless of which muxing approach is used.

### Main Thread Integration (`useVideoExporter`)

The hook's public API does not change:

```typescript
interface UseVideoExporterReturn {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}
```

Internally, `startExport` becomes:
1. Detect WebCodecs support (`hasWebCodecsSupport()`)
2. Extract `Float32Array` channels from `AudioBuffer`
3. Spawn Worker: `new Worker(new URL('./export.worker.ts', import.meta.url))`
4. Transfer audio data + config via `postMessage`
5. Listen for `progress` → `setExportProgress()`
6. Listen for `complete` → `URL.createObjectURL(blob)` → `setExportedUrl()`
7. Listen for `error` → `setError()`

`cancelExport` sends `{ type: 'abort' }` then calls `worker.terminate()`.

The `canvas` parameter in `startExport` is no longer used for encoding (the Worker has its own OffscreenCanvas), but the signature stays for backward compatibility with `ExportState`.

## What Changes

| File | Change |
|------|--------|
| `apps/web/src/lib/export.worker.ts` | **New** — Worker entry point |
| `apps/web/src/hooks/useVideoExporter.ts` | **Rewrite** — spawn Worker instead of calling encoders directly |
| `apps/web/src/lib/videoEncoder.ts` | **Delete or move** — logic moves into Worker |
| `apps/web/src/lib/ffmpegEncoder.ts` | **Delete or move** — logic moves into Worker |
| `apps/web/src/lib/frameRenderer.ts` | **No change** — pure function, works on any canvas context |
| `apps/web/src/lib/fontLoader.ts` | **Extract** — shared font loading logic usable in Worker context |
| `apps/web/src/lib/graphicLoader.ts` | **No change** — fetch-based, works in Workers |
| `apps/web/src/components/soul/ExportState.tsx` | **No change** — same hook API |
| `apps/web/src/components/primitives/CanvasPreview.tsx` | **No change** — independent canvas |

## What Does NOT Change

- `useVideoExporter` return interface
- `ExportState.tsx` component
- `CanvasPreview.tsx` — keeps rendering on main thread
- `renderFrame()` — pure function, works on any 2D context
- Store shape, transcript format, style types

## Bundle Impact

| | Before | After |
|---|--------|-------|
| Main JS | Includes mediabunny (~400-600 KB) | App code only |
| Encoder code | Loaded on page visit | Loaded on-demand in Worker |
| ffmpeg.wasm | Already lazy ✓ | Still lazy, inside Worker |
| Initial page load | Heavier | Lighter |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mediabunny `CanvasSource` rejects OffscreenCanvas | Fall back to raw `VideoEncoder` + `mp4-muxer` |
| `FontFace` API unavailable in some Worker contexts | Feature-detect; fall back to default font (Inter via system) |
| `OfflineAudioContext` unavailable in Worker | Construct WAV from raw PCM as fallback (existing pattern) |
| Next.js Worker bundling quirks | Use `new URL('./worker.ts', import.meta.url)` pattern (webpack 5 native) |

## Success Criteria

- UI remains fully responsive during export (preview animates, buttons respond)
- Export produces identical MP4 output (same quality, same codec settings)
- Main bundle size decreases (mediabunny no longer in initial load)
- Both WebCodecs and ffmpeg.wasm paths work from the Worker
- Cancellation works (stops encoding, cleans up Worker)
- Progress reporting is smooth (1% granularity)
