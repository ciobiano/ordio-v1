# Implementation Plan — Phase 1 Build

## Build Order (dependency-driven)

The critical path is: **Canvas Renderer → Mediabunny Encoder → Wire into UI → Polish**

### Step 1: Canvas Frame Renderer (`apps/web/src/lib/frameRenderer.ts`)
**Why first:** Everything downstream (encoding, preview) needs frames to exist.

Create a pure function `renderFrame(ctx, frameIndex, options)` that draws one video frame:
- **Background:** fill with `style.backgroundColor`
- **Waveform:** use `waveformSampler()` from `packages/shared` to get bar data, then draw bars/line/circle based on `waveformStyle`. Animate by windowing the waveform data around `currentTime` (derived from `frameIndex / FPS`).
- **Captions:** use `layoutCaption()` from `packages/shared` to compute line breaks, then draw text with `ctx.fillText()`. Highlight the active word (whose `start <= currentTime < end`) for karaoke style.
- **Inputs:** `{ ctx: CanvasRenderingContext2D, frameIndex: number, totalFrames: number, waveformData: number[], transcript: Word[], style: StyleConfig, waveformStyle: WaveformVariant, captionStyle: CaptionVariant }`
- **No React, no hooks** — pure canvas drawing, testable in isolation.

Files:
- New: `apps/web/src/lib/frameRenderer.ts`
- Test: `apps/web/src/__tests__/frameRenderer.test.ts`

---

### Step 2: Mediabunny MP4 Encoder (`apps/web/src/lib/videoEncoder.ts`)
**Why second:** With frames renderable, we need to encode them.

Create an `encodeVideo()` async function:
- Accept: `{ canvas, audioBuffer, waveformData, transcript, style, waveformStyle, captionStyle, onProgress }`
- Loop frame by frame (30fps × duration seconds):
  1. Call `renderFrame()` for each frame
  2. Create `VideoFrame` from canvas
  3. Feed to `VideoEncoder` (H.264)
- Encode audio via `AudioEncoder` (AAC) from AudioBuffer channel data
- Mux both streams via Mediabunny into MP4
- Return `Blob`
- Progress callback: `onProgress(frameIndex / totalFrames)`

Files:
- New: `apps/web/src/lib/videoEncoder.ts`
- Install: `mediabunny` package

---

### Step 3: Update `useVideoExporter` hook
**Why third:** Replace the current captureStream/MediaRecorder approach with the new encoder.

Changes to `apps/web/src/hooks/useVideoExporter.ts`:
- `startExport(canvas, audioBuffer)` now calls `encodeVideo()` from Step 2
- Pre-compute waveform data once via `waveformSampler(audioBuffer, sampleCount)`
- Read `transcript`, `style`, `waveformStyle`, `captionStyle` from Zustand store
- Keep the same return interface (`UseVideoExporterReturn`) so ExportState doesn't change
- Remove `captureStream()` and `MediaRecorder` code entirely

Files:
- Edit: `apps/web/src/hooks/useVideoExporter.ts`
- No changes to `ExportState.tsx` or `page.tsx` (same interface)

---

### Step 4: Live Canvas Preview in ExportState
**Why fourth:** Users need to see what they'll export before hitting Export.

Replace the static `VideoPreview` mockup with a live canvas preview:
- Create `CanvasPreview` component that renders `renderFrame()` in a small preview canvas
- Sync to `playback.currentTime` — as audio plays, the preview updates in real-time
- Use `requestAnimationFrame` loop during playback, single render when paused
- Scale down to fit the preview container (CSS `object-fit` or manual scaling)

Files:
- New: `apps/web/src/components/primitives/CanvasPreview.tsx`
- Edit: `apps/web/src/components/soul/ExportState.tsx` — swap `VideoPreview` for `CanvasPreview`

---

### Step 5: WebCodecs Detection in `useCapabilities`
**Why fifth:** Need to know if the encoder will work before the user tries to export.

Add to `useCapabilities`:
- Detect `VideoEncoder` and `AudioEncoder` on `window`
- Add `hasWebCodecs: boolean` to capabilities
- If no WebCodecs, add warning: "Your browser doesn't support hardware-accelerated export. Export may be slower."
- ffmpeg.wasm fallback is Phase 2 — for now, just warn

Files:
- Edit: `apps/web/src/hooks/useCapabilities.ts`

---

### Step 6: Verify & Test
- `pnpm lint && pnpm type-check && pnpm test`
- Manual test in Chrome: record → process → preview plays with live canvas → export → download MP4
- Verify MP4 plays in QuickTime, VLC, and social media upload

---

## What We're NOT Doing in This Sprint

- **wavesurfer.js** — the existing custom waveform components (BarsWaveform, CircleWaveform, LineWaveform) work fine for UI. wavesurfer.js is a nice-to-have for the Regions plugin later. Defer to avoid scope creep.
- **ffmpeg.wasm fallback** — defer until we verify which browsers actually fail with WebCodecs.
- **Caption editor improvements** — CaptionEditor already exists and works. Polish later.
- **Style controls expansion** — StyleControls already has colors, font, font size. Polish later.
- **v1 dep cleanup** — not blocking anything. Do after export works.

## Estimated File Changes

| File | Action | Lines (est.) |
|---|---|---|
| `apps/web/src/lib/frameRenderer.ts` | **New** | ~150 |
| `apps/web/src/__tests__/frameRenderer.test.ts` | **New** | ~80 |
| `apps/web/src/lib/videoEncoder.ts` | **New** | ~120 |
| `apps/web/src/hooks/useVideoExporter.ts` | **Rewrite** | ~80 |
| `apps/web/src/components/primitives/CanvasPreview.tsx` | **New** | ~80 |
| `apps/web/src/components/soul/ExportState.tsx` | **Edit** | ~5 lines |
| `apps/web/src/hooks/useCapabilities.ts` | **Edit** | ~10 lines |
| `apps/web/package.json` | **Edit** | +1 dep |

Total: ~3 new files, ~3 edits to existing files. Core value delivered: **working MP4 export pipeline**.
