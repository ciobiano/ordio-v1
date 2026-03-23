# Free Tier Watermark — Design Spec

**Date:** 2026-03-11
**Status:** Approved

---

## Overview

A text watermark is automatically burned into every exported video for free-tier users. It is not visible in the canvas preview — it only appears in the downloaded MP4. Upgrading to Creator or Pro removes it silently.

---

## Watermark Spec

| Property | Value |
|---|---|
| Text | `Ordio by Kaine Studio` |
| Font | Geist Regular (400) |
| Font size | 14px |
| Colour | `rgba(255, 255, 255, 0.55)` |
| Position | Top-left corner |
| Padding from edge | 16px left, 16px top |
| Rendered on | Every frame, on top of all other content |
| Background | None — text only, no circle or badge |

---

## When It Applies

- **Free tier:** watermark on every exported frame
- **Creator / Pro / Agency:** no watermark — no rendering code runs
- **Unauthenticated:** not possible — auth is required to use the app. `tier` is always defined.

The `showWatermark` boolean is computed in `page.tsx` and passed as an argument to `exporter.startExport()`:

```ts
// page.tsx — already implemented
await exporter.startExport(canvas, audioBuffer, tier === 'free');
```

`useVideoExporter.startExport()` receives it as a parameter and forwards it into the encoder options. `CanvasPreview` does not pass `showWatermark`, so it defaults to `false` from `FrameOptions` (optional field).

---

## Existing Infrastructure (no changes needed)

`FrameOptions` in `lib/frameRenderer.ts` already has:

```ts
showWatermark?: boolean;
```

`renderFrame()` already calls:

```ts
if (showWatermark) {
  drawWatermark(ctx, width, height);
}
```

These do **not** need to change.

---

## Changes to `drawWatermark()` (`lib/frameRenderer.ts`)

The existing `drawWatermark()` function needs the following updates:

| What | Current (wrong) | Target |
|---|---|---|
| Text | `'Made with Ordio'` | `'Ordio by Kaine Studio'` |
| Font | `500 13px "Plus Jakarta Sans"` | `400 14px "Geist"` |
| Position | Bottom-right (`width - 24`, `height - 24`) | Top-left (`x = 16`, `y = 16`) |
| Alignment | `textAlign: 'right'`, `textBaseline: 'middle'` | `textAlign: 'left'`, `textBaseline: 'top'` |
| Circle background | Present (arc + fill) | **Removed** |

Updated function — replace the existing `drawWatermark()` body:

```ts
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.font = '400 14px "Geist", sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('Ordio by Kaine Studio', 16, 16)
  ctx.restore()
}
```

> `width` and `height` parameters are retained in the signature to keep the call site unchanged. They are unused in the new body.

---

## Font Loading (`lib/fontLoader.ts`)

Geist is not on Google Fonts. Load it via the `geist` npm package:

1. Add `geist` to `apps/web/package.json` dependencies.
2. Copy `Geist-Regular.woff2` from the package into `apps/web/public/fonts/`.
3. Add a local-fonts path to `fontLoader.ts` alongside the existing Google Fonts path:

```ts
// In fontLoader.ts — add above FONT_CONFIG:
const LOCAL_FONTS: Record<string, string> = {
  Geist: '/fonts/Geist-Regular.woff2',
};

async function doLoad(fontFamily: string): Promise<void> {
  try {
    const localSrc = LOCAL_FONTS[fontFamily];
    if (localSrc) {
      const face = new FontFace(fontFamily, `url(${localSrc})`, { weight: '400' });
      await face.load();
      document.fonts.add(face);
      loaded.add(fontFamily);
      return;
    }

    // ... existing Google Fonts path unchanged (spec omitted for brevity)
  } catch {
    // Silently fall back — canvas will use sans-serif
    // For watermark: acceptable; text still renders, just in wrong font
    loaded.add(fontFamily);
  } finally {
    loading.delete(fontFamily);  // ← preserve existing cleanup
  }
}
```

### Where to call `loadFont('Geist')`

`loadFont('Geist')` must be called in **both** encoder files before the render loop, alongside the existing `loadFont(style.fontFamily)` call:

- `lib/videoEncoder.ts` line ~67: add `await loadFont('Geist');` after `await loadFont(style.fontFamily);`
- `lib/ffmpegEncoder.ts` line ~40: same addition

This ensures Geist is in `document.fonts` before any frame is rendered. The silent-fallback behavior (existing pattern) is acceptable — a failed Geist load still renders the watermark text in `sans-serif`, which is functionally present.

---

## Canvas Preview

The watermark is **not rendered** in `CanvasPreview`. Already handled by `showWatermark: false`. No change needed.

---

## Out of Scope

- Creator custom watermark / logo overlay (separate future feature)
- Watermark position configurability
- Animated watermark
