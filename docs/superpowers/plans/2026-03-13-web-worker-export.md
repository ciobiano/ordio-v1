# Web Worker Export Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the video encoding pipeline into a Web Worker with OffscreenCanvas so the UI stays responsive during export.

**Architecture:** Single `export.worker.ts` with its own OffscreenCanvas. Main thread spawns Worker, transfers audio data (zero-copy), receives progress + blob back. Both Mediabunny (WebCodecs) and ffmpeg.wasm paths run inside the Worker via dynamic import.

**Tech Stack:** Web Workers, OffscreenCanvas, Mediabunny, ffmpeg.wasm, FontFace API, ImageBitmap

**Spec:** `docs/superpowers/specs/2026-03-13-web-worker-export-design.md`

---

## Chunk 1: Foundation — Types, GraphicLoader, Waveform Widening

### Task 1: RenderContext Type Alias

**Files:**
- Create: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Create the type alias file**

```typescript
// apps/web/src/lib/types.ts
export type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add RenderContext type alias for Worker compatibility"
```

---

### Task 2: Widen Waveform Function Signatures

**Files:**
- Modify: `apps/web/src/lib/waveforms/constants.ts`
- Modify: `apps/web/src/lib/waveforms/bars.ts`
- Modify: `apps/web/src/lib/waveforms/circle.ts`
- Modify: `apps/web/src/lib/waveforms/spectrogram.ts`

- [ ] **Step 1: Update `constants.ts`**

Import `RenderContext` from `@/lib/types`. Change:
- `WaveformDrawFn` type: `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext`
- `drawPillRect` param: `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext`

- [ ] **Step 2: Update `bars.ts`**

Import `RenderContext` from `@/lib/types`. Change `drawPillBars` param: `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext`.

- [ ] **Step 3: Update `circle.ts`**

Same pattern -- import `RenderContext`, update `drawCircleWaveform` param.

- [ ] **Step 4: Update `spectrogram.ts`**

Same pattern -- import `RenderContext`, update `drawSpectrogram` param.

- [ ] **Step 5: Run type-check**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run existing tests**

Run: `pnpm --filter=web vitest run`
Expected: All tests pass (no runtime behavior change)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/waveforms/
git commit -m "refactor: widen waveform functions to accept RenderContext"
```

---

### Task 3: Migrate graphicLoader to ImageBitmap

**Files:**
- Modify: `apps/web/src/lib/graphicLoader.ts`
- Modify: `apps/web/src/__tests__/graphicLoader.test.ts`

- [ ] **Step 1: Update the test to expect ImageBitmap**

Rewrite `graphicLoader.test.ts`:
- Stub `globalThis.fetch` to return a mock `Response` with a `blob()` method
- Stub `globalThis.createImageBitmap` to return an object with `{ width, height }`
- Test `loadGraphic('graphic-frame1')` resolves with an `ImageBitmap`-like object
- Test `loadGraphic` rejects when fetch fails
- Test `getGraphic` returns null before load
- Test cache behavior (second call returns same object, no re-fetch)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('graphicLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  function stubFetchAndBitmap(width: number, height: number) {
    const mockBlob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }));
    const bitmap = { width, height, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    return { bitmap };
  }

  it('loadGraphic resolves with an ImageBitmap for graphic-frame1', async () => {
    stubFetchAndBitmap(340, 355);
    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame1');
    expect(img).toBeDefined();
    expect(img.width).toBe(340);
    expect(globalThis.fetch).toHaveBeenCalledWith('/graphic-styles/frame1.svg');
  });

  it('loadGraphic resolves for graphic-frame2', async () => {
    stubFetchAndBitmap(321, 189);
    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame2');
    expect(img.width).toBe(321);
    expect(globalThis.fetch).toHaveBeenCalledWith('/graphic-styles/frame2.svg');
  });

  it('loadGraphic rejects on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { loadGraphic } = await import('@/lib/graphicLoader');
    await expect(loadGraphic('graphic-frame1')).rejects.toThrow(
      'Failed to load graphic'
    );
  });

  it('getGraphic returns null before any load', async () => {
    const { getGraphic } = await import('@/lib/graphicLoader');
    expect(getGraphic('graphic-frame1')).toBeNull();
  });

  it('caches loaded graphics -- no re-fetch on second call', async () => {
    stubFetchAndBitmap(340, 355);
    const { loadGraphic } = await import('@/lib/graphicLoader');
    await loadGraphic('graphic-frame1');
    await loadGraphic('graphic-frame1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test -- verify it fails**

Run: `pnpm --filter=web vitest run src/__tests__/graphicLoader.test.ts`
Expected: FAIL (graphicLoader still uses `HTMLImageElement`)

- [ ] **Step 3: Rewrite graphicLoader.ts**

```typescript
import type { GraphicStyleId } from '@/lib/store';

const cache = new Map<string, ImageBitmap>();

export async function loadGraphic(
  id: NonNullable<GraphicStyleId>
): Promise<ImageBitmap> {
  const cached = cache.get(id);
  if (cached) return cached;

  const src =
    id === 'graphic-frame1'
      ? '/graphic-styles/frame1.svg'
      : '/graphic-styles/frame2.svg';

  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to load graphic: ${id}`);

  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  cache.set(id, bitmap);
  return bitmap;
}

export function getGraphic(
  id: NonNullable<GraphicStyleId>
): ImageBitmap | null {
  return cache.get(id) ?? null;
}
```

- [ ] **Step 4: Run test -- verify it passes**

Run: `pnpm --filter=web vitest run src/__tests__/graphicLoader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/graphicLoader.ts apps/web/src/__tests__/graphicLoader.test.ts
git commit -m "refactor: migrate graphicLoader from HTMLImageElement to ImageBitmap"
```

---

### Task 4: Update frameRenderer for RenderContext + ImageBitmap

**Files:**
- Modify: `apps/web/src/lib/frameRenderer.ts`
- Modify: `apps/web/src/__tests__/frameRenderer.test.ts`

- [ ] **Step 1: Update frameRenderer.ts signatures**

Import `RenderContext` from `@/lib/types`. Update these functions:

| Function | Change |
|----------|--------|
| `renderFrame` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |
| `drawGraphic` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext`; `img: HTMLImageElement` -> `img: ImageBitmap` |
| `drawWaveform` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |
| `drawCaptions` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |
| `drawKaraokeCaptions` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |
| `drawWatermark` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |
| `wrapText` | `ctx: CanvasRenderingContext2D` -> `ctx: RenderContext` |

In `drawGraphic`, replace `naturalWidth`/`naturalHeight` with `width`/`height` on **all 3 lines** (ImageBitmap uses `.width`/`.height`):
- Line 76: `img.naturalWidth / img.naturalHeight` -> `img.width / img.height`
- Line 91: `new OffscreenCanvas(img.naturalWidth, img.naturalHeight)` -> `new OffscreenCanvas(img.width, img.height)`
- Line 96: `octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight)` -> `octx.fillRect(0, 0, img.width, img.height)`

- [ ] **Step 2: Update frameRenderer.test.ts mock context type**

In `createMockCtx()`, change the return type cast:
```typescript
return new Proxy({}, handler) as unknown as RenderContext;
```
Import `RenderContext` from `@/lib/types`.

In the graphic cache test (the `drawImage` test), update the mock `getGraphic` return:
```typescript
getGraphic: () => ({ width: 321, height: 189 }) as unknown as ImageBitmap,
```

- [ ] **Step 3: Verify CanvasPreview.tsx still compiles**

`CanvasPreview.tsx` imports `loadGraphic` and passes results through to `renderFrame`. After Tasks 3-4, it receives `ImageBitmap` instead of `HTMLImageElement`. Verify no type annotations in `CanvasPreview.tsx` reference `HTMLImageElement` explicitly. If so, update them.

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter=web vitest run`
Expected: All tests pass

- [ ] **Step 5: Run type-check**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/frameRenderer.ts apps/web/src/__tests__/frameRenderer.test.ts
git commit -m "refactor: update frameRenderer to use RenderContext + ImageBitmap"
```

---

## Chunk 2: Worker Infrastructure

### Task 5: Worker Font Loader

**Files:**
- Create: `apps/web/src/lib/workerFontLoader.ts`
- Create: `apps/web/src/__tests__/workerFontLoader.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('workerFontLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('loads a local font (Geist) via FontFace', async () => {
    const mockFontFace = { load: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal(
      'FontFace',
      vi.fn().mockReturnValue(mockFontFace)
    );
    const mockFonts = { add: vi.fn() };
    vi.stubGlobal('self', {
      fonts: mockFonts,
      location: { origin: 'http://localhost:3000' },
    });

    const { loadFontInWorker } = await import('@/lib/workerFontLoader');
    await loadFontInWorker('Geist');

    expect(globalThis.FontFace).toHaveBeenCalledWith(
      'Geist',
      expect.stringContaining('/fonts/Geist-Regular.woff2'),
      expect.objectContaining({ weight: '400' })
    );
    expect(mockFontFace.load).toHaveBeenCalled();
    expect(mockFonts.add).toHaveBeenCalledWith(mockFontFace);
  });

  it('loads a Google Font by fetching CSS and parsing woff2 URL', async () => {
    const woff2Url = 'https://fonts.gstatic.com/s/inter/v18/xxx.woff2';
    const cssResponse = `
      @font-face {
        font-family: 'Inter';
        src: url(${woff2Url}) format('woff2');
        font-weight: 600;
      }
    `;
    const woff2Data = new ArrayBuffer(100);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(woff2Data),
        })
    );

    const mockFontFace = { load: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal(
      'FontFace',
      vi.fn().mockReturnValue(mockFontFace)
    );
    const mockFonts = { add: vi.fn() };
    vi.stubGlobal('self', {
      fonts: mockFonts,
      location: { origin: 'http://localhost:3000' },
    });

    const { loadFontInWorker } = await import('@/lib/workerFontLoader');
    await loadFontInWorker('Inter');

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.FontFace).toHaveBeenCalled();
    expect(mockFonts.add).toHaveBeenCalled();
  });

  it('silently succeeds for unknown font families', async () => {
    const { loadFontInWorker } = await import('@/lib/workerFontLoader');
    await expect(
      loadFontInWorker('UnknownFont')
    ).resolves.not.toThrow();
  });

  it('does not re-fetch already loaded fonts', async () => {
    const mockFontFace = { load: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal(
      'FontFace',
      vi.fn().mockReturnValue(mockFontFace)
    );
    const mockFonts = { add: vi.fn() };
    vi.stubGlobal('self', {
      fonts: mockFonts,
      location: { origin: 'http://localhost:3000' },
    });

    const { loadFontInWorker } = await import('@/lib/workerFontLoader');
    await loadFontInWorker('Geist');
    await loadFontInWorker('Geist');

    expect(globalThis.FontFace).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test -- verify it fails**

Run: `pnpm --filter=web vitest run src/__tests__/workerFontLoader.test.ts`
Expected: FAIL (module does not exist)

- [ ] **Step 3: Implement workerFontLoader.ts**

```typescript
/**
 * Font loader for Web Worker context.
 * Uses FontFace API + self.fonts (no DOM access).
 * Google Fonts: fetch CSS -> parse woff2 URLs -> load binary -> FontFace.
 */

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

const LOCAL_FONTS: Record<string, { src: string; weight: string }> = {
  Geist: { src: '/fonts/Geist-Regular.woff2', weight: '400' },
};

const FONT_CONFIG: Record<string, { spec: string; weight: string }> = {
  Inter: { spec: 'Inter:wght@600', weight: '600' },
  Roboto: { spec: 'Roboto:wght@500', weight: '500' },
  Outfit: { spec: 'Outfit:wght@600', weight: '600' },
};

const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();

export async function loadFontInWorker(
  fontFamily: string
): Promise<void> {
  if (loaded.has(fontFamily)) return;

  const existing = loading.get(fontFamily);
  if (existing) return existing;

  const promise = doLoad(fontFamily);
  loading.set(fontFamily, promise);
  return promise;
}

async function doLoad(fontFamily: string): Promise<void> {
  try {
    const local = LOCAL_FONTS[fontFamily];
    if (local) {
      const face = new FontFace(fontFamily, `url(${local.src})`, {
        weight: local.weight,
      });
      await face.load();
      (self as unknown as { fonts: FontFaceSet }).fonts.add(face);
      loaded.add(fontFamily);
      return;
    }

    const config = FONT_CONFIG[fontFamily];
    if (!config) {
      loaded.add(fontFamily);
      return;
    }

    const url = `${GOOGLE_FONTS_CSS}?family=${encodeURIComponent(config.spec)}&display=swap`;
    const cssRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!cssRes.ok) {
      loaded.add(fontFamily);
      return;
    }

    const css = await cssRes.text();
    const woff2Urls = [
      ...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g),
    ].map((m) => m[1]);

    for (const woff2Url of woff2Urls) {
      const fontRes = await fetch(woff2Url);
      if (!fontRes.ok) continue;
      const buffer = await fontRes.arrayBuffer();
      const face = new FontFace(fontFamily, buffer, {
        weight: config.weight,
      });
      await face.load();
      (self as unknown as { fonts: FontFaceSet }).fonts.add(face);
    }

    loaded.add(fontFamily);
  } catch {
    // Silently fall back -- canvas will use sans-serif
    loaded.add(fontFamily);
  } finally {
    loading.delete(fontFamily);
  }
}
```

- [ ] **Step 4: Run test -- verify it passes**

Run: `pnpm --filter=web vitest run src/__tests__/workerFontLoader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/workerFontLoader.ts apps/web/src/__tests__/workerFontLoader.test.ts
git commit -m "feat: add workerFontLoader -- Worker-compatible font loading via FontFace API"
```

---

### Task 6: Export Worker

**Files:**
- Create: `apps/web/src/lib/export.worker.ts`
- Modify: `apps/web/src/lib/types.ts` (add message types)

- [ ] **Step 1: Add Worker message types to types.ts**

Append to `apps/web/src/lib/types.ts`:

```typescript
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { WaveformVariant, CaptionVariant, GraphicStyleId } from '@/lib/store';

export interface ExportWorkerStartPayload {
  audioChannels: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  transcript: Word[];
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  captionStyle: CaptionVariant;
  graphicStyle: GraphicStyleId | undefined;
  showWatermark: boolean;
  useWebCodecs: boolean;
}

export type ExportWorkerInMessage =
  | { type: 'start'; payload: ExportWorkerStartPayload }
  | { type: 'abort' };

export type ExportWorkerOutMessage =
  | { type: 'progress'; value: number }
  | { type: 'complete'; blob: Blob }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: Create export.worker.ts**

The Worker entry point. Receives 'start' message, creates OffscreenCanvas, runs the full encoding pipeline, posts progress and result back.

Key implementation details:
- `OffscreenCanvas` created inside the Worker (not transferred)
- Fonts loaded via `loadFontInWorker()` from `workerFontLoader.ts`
- Graphics loaded via `loadGraphic()` from updated `graphicLoader.ts` (uses `fetch` + `createImageBitmap`)
- Audio data wrapped in `AudioData` interface for `waveformSampler()`
- WebCodecs path: `OfflineAudioContext` to reconstruct `AudioBuffer` for Mediabunny
- ffmpeg path: `canvas.convertToBlob()` (not `canvas.toBlob()`), `self.location.origin` (not `window`)
- `audioDataToWav()` encodes raw `Float32Array[]` channels (adapted from `ffmpegEncoder.ts`)
- Mediabunny `CanvasSource` receives `canvas as unknown as HTMLCanvasElement` -- if this fails at runtime, execute Task 6a

See spec `docs/superpowers/specs/2026-03-13-web-worker-export-design.md` sections "Worker Internals", "Audio Data Transfer", and "Mediabunny + OffscreenCanvas Compatibility" for full implementation reference.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS

If Worker global type errors, ensure `apps/web/tsconfig.json` includes `"webworker"` in `compilerOptions.lib`. Note: adding `"webworker"` alongside `"dom"` may cause type conflicts for `fetch`, `Request`, etc. If so, create a separate `tsconfig.worker.json` that extends the base config with `"lib": ["esnext", "webworker"]` and add a `/// <reference lib="webworker" />` triple-slash directive at the top of the Worker file instead.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/export.worker.ts apps/web/src/lib/types.ts
git commit -m "feat: add export.worker.ts -- Web Worker encoding pipeline"
```

---

### Task 6a: mp4-muxer Fallback (Conditional)

**Only run this task if Mediabunny's `CanvasSource` rejects `OffscreenCanvas` at runtime during manual testing.**

- [ ] **Step 1: Install mp4-muxer**

Run: `pnpm --filter=web add mp4-muxer`

- [ ] **Step 2: Replace `encodeWithWebCodecs` in export.worker.ts**

Replace Mediabunny usage with raw `VideoEncoder` + `mp4-muxer`. Use `new VideoFrame(canvas, { timestamp })` to create frames from `OffscreenCanvas`.

- [ ] **Step 3: Manual test -- verify MP4 plays correctly**

- [ ] **Step 4: Remove mediabunny if fully replaced**

Run: `pnpm --filter=web remove mediabunny`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: replace Mediabunny with mp4-muxer for OffscreenCanvas compatibility"
```

---

## Chunk 3: Integration and Cleanup

### Task 7: Rewrite useVideoExporter

**Files:**
- Modify: `apps/web/src/hooks/useVideoExporter.ts`

- [ ] **Step 1: Rewrite the hook**

Key changes:
- Remove imports of `encodeVideo`, `encodeVideoFFmpeg`
- Import `ExportWorkerInMessage`, `ExportWorkerOutMessage` from `@/lib/types`
- **Re-define `hasWebCodecsSupport()` in this file** (previously in `videoEncoder.ts` which gets deleted in Task 9):
  ```typescript
  function hasWebCodecsSupport(): boolean {
    return (
      typeof globalThis.VideoEncoder !== 'undefined' &&
      typeof globalThis.AudioEncoder !== 'undefined'
    );
  }
  ```
- **Keep `fileExtension()` as a named export** (existing test at `__tests__/fileExtension.test.ts` imports it)
- `startExport` signature: remove `canvas` param -> `(audioBuffer: AudioBuffer, showWatermark?: boolean)`
- Spawn Worker: `new Worker(new URL('../lib/export.worker.ts', import.meta.url))`
- Extract `Float32Array` channels from `audioBuffer`, transfer via `postMessage` Transferable list
- Listen for Worker messages: `progress` -> `setExportProgress`, `complete` -> `setExportedUrl`, `error` -> `setError`
- `cancelExport`: send `{ type: 'abort' }` then `worker.terminate()`
- Cleanup: terminate Worker + revoke URLs in `useEffect` return
- Export `fileExtension` and `hasWebCodecsSupport` as named exports

- [ ] **Step 2: Type-check**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useVideoExporter.ts
git commit -m "feat: rewrite useVideoExporter to spawn export Worker"
```

---

### Task 8: Update page.tsx Call Site

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Remove `createInitializedCanvas` and update `handleExport`**

Delete `createInitializedCanvas` function (lines 36-47). Remove `getCanvasDimensions` from imports if unused.

Update `handleExport`:
```typescript
const handleExport = useCallback(async () => {
  const gate = await exportGate.checkAndConsume();
  if (!gate.allowed) {
    setUpgradeTarget('export_limit');
    return;
  }

  const { audioBuffer } = useStore.getState();
  if (!audioBuffer) return;

  await exporter.startExport(audioBuffer, tier === 'free');
}, [exporter, exportGate, tier]);
```

Remove `format` from dependency array.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter=web tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "refactor: remove canvas creation from page.tsx -- Worker owns OffscreenCanvas"
```

---

### Task 9: Delete Old Encoder Files

**Files:**
- Delete: `apps/web/src/lib/videoEncoder.ts`
- Delete: `apps/web/src/lib/ffmpegEncoder.ts`

- [ ] **Step 1: Check for remaining imports**

Run: `pnpm --filter=web tsc --noEmit`
Fix any remaining imports of `videoEncoder.ts` or `ffmpegEncoder.ts` before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm apps/web/src/lib/videoEncoder.ts apps/web/src/lib/ffmpegEncoder.ts
```

- [ ] **Step 3: Type-check and test**

Run: `pnpm --filter=web tsc --noEmit && pnpm --filter=web vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u apps/web/src/lib/videoEncoder.ts apps/web/src/lib/ffmpegEncoder.ts
git commit -m "chore: delete videoEncoder + ffmpegEncoder -- logic moved to export.worker.ts"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Manual test -- WebCodecs path (Chrome/Edge)**

1. `pnpm dev --filter=web`
2. Record 5 seconds of audio
3. Click Export -- verify UI stays responsive (captions animate, buttons respond)
4. Download MP4 -- verify it plays in QuickTime/VLC
5. Verify progress bar updates smoothly

- [ ] **Step 5: Manual test -- ffmpeg.wasm path**

In Chrome DevTools console, run `delete window.VideoEncoder` to force fallback.
Repeat steps 2-5 above.

- [ ] **Step 6: Manual test -- cancellation**

Start export, immediately click cancel. Verify UI resets without errors.

- [ ] **Step 7: Verify bundle improvement**

Run: `pnpm --filter=web build`
Compare `.next/static/chunks` sizes. Mediabunny should not appear in main chunks.

- [ ] **Step 8: Final commit if any fixups were needed**

```bash
git commit -am "chore: verify Web Worker export pipeline -- all tests pass"
```
