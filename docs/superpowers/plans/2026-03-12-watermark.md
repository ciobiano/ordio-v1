# Free Tier Watermark Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the existing free-tier export watermark to display "Ordio by Kaine Studio" in Geist Regular at the top-left corner, removing the old text, wrong font, bottom-right position, and circle background.

**Architecture:** Two isolated changes: (1) update the body of the existing `drawWatermark()` in `frameRenderer.ts`; (2) add Geist as a local font in `fontLoader.ts` and call `loadFont('Geist')` in both encoders before the render loop.

**Tech Stack:** Canvas 2D API, FontFace API, geist npm package (Vercel)

---

## Chunk 1: All Changes

### Task 1: Add watermark tests + update `drawWatermark()`

**Files:**
- `apps/web/src/__tests__/frameRenderer.test.ts` — tests first
- `apps/web/src/lib/frameRenderer.ts` — then implementation (lines 192–217)

#### Step 1.1 — Write failing tests

- [ ] Open `apps/web/src/__tests__/frameRenderer.test.ts`
- [ ] Add the following two tests inside the existing `describe` block (or a new `describe('drawWatermark', ...)` block):

```ts
it('renders watermark at top-left with "Ordio by Kaine Studio" in Geist font', () => {
  const ctx = createMockCtx();
  const options = makeOptions({ showWatermark: true });
  renderFrame(ctx, 0, 90, options);

  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

  const fillTextCall = calls.find(
    (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio',
  );
  expect(fillTextCall).toBeDefined();
  expect(fillTextCall?.args[1]).toBe(16); // x
  expect(fillTextCall?.args[2]).toBe(16); // y

  const fontSet = calls.find(
    (c) => c.method === 'set:font' && String(c.args[0]).includes('Geist'),
  );
  expect(fontSet).toBeDefined();

  const arcCall = calls.find((c) => c.method === 'arc');
  expect(arcCall).toBeUndefined();
});

it('does not render watermark when showWatermark is false or omitted', () => {
  const ctx = createMockCtx();

  // showWatermark: false
  renderFrame(ctx, 0, 90, makeOptions({ showWatermark: false }));
  let calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
  let fillTextWatermark = calls.find(
    (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio',
  );
  expect(fillTextWatermark).toBeUndefined();

  // showWatermark omitted (default)
  const ctx2 = createMockCtx();
  renderFrame(ctx2, 0, 90, makeOptions());
  calls = (ctx2 as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
  fillTextWatermark = calls.find(
    (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio',
  );
  expect(fillTextWatermark).toBeUndefined();
});
```

- [ ] Run tests — confirm they **fail** (RED):
  ```
  pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
  ```
  Expected: both new tests fail because `drawWatermark()` still uses old text and position.

#### Step 1.2 — Implement the fix

- [ ] In `apps/web/src/lib/frameRenderer.ts`, replace the entire body of `drawWatermark()` (lines 192–217) with:

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

  > `width` and `height` are retained in the signature to keep the call site unchanged. They are intentionally unused in the new body.

- [ ] Run tests — confirm they **pass** (GREEN):
  ```
  pnpm --filter=web vitest run src/__tests__/frameRenderer.test.ts
  ```
  Expected: all tests pass.

- [ ] Commit:
  ```
  git add apps/web/src/lib/frameRenderer.ts apps/web/src/__tests__/frameRenderer.test.ts
  git commit -m "feat(watermark): update drawWatermark — Geist font, top-left, no circle"
  ```

---

### Task 2: Install geist package + copy font file

- [ ] Install the `geist` npm package into the web app:
  ```
  pnpm add geist --filter=web
  ```
  Expected: `geist` appears in `apps/web/package.json` dependencies and `pnpm-lock.yaml` is updated.

- [ ] Locate the Geist Regular woff2 file inside the installed package:
  ```
  find apps/web/node_modules/geist -name "*.woff2" | sort
  ```
  Look for a file matching `Geist-Regular.woff2` or similar (weight 400, not Bold/Light).

- [ ] Create the fonts directory:
  ```
  mkdir -p apps/web/public/fonts
  ```

- [ ] Copy the Regular woff2 to the public directory (adjust source path if different):
  ```
  cp apps/web/node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2 \
     apps/web/public/fonts/Geist-Regular.woff2
  ```

- [ ] Verify the file was copied:
  ```
  ls -lh apps/web/public/fonts/
  ```
  Expected: `Geist-Regular.woff2` is present, non-zero size.

- [ ] Commit the font file and updated lockfile:
  ```
  git add apps/web/package.json pnpm-lock.yaml apps/web/public/fonts/Geist-Regular.woff2
  git commit -m "chore(watermark): add geist package and copy Geist-Regular.woff2 to public/fonts"
  ```

---

### Task 3: Add local font support to `fontLoader.ts` + test

**Files:**
- `apps/web/src/__tests__/fontLoader.test.ts` — new test file, tests first
- `apps/web/src/lib/fontLoader.ts` — then implementation

#### Step 3.1 — Write failing test

- [ ] Create `apps/web/src/__tests__/fontLoader.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FontFace and document.fonts before importing the module
const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockFontFace = vi.fn().mockImplementation((_family, _src, _descriptors) => ({
  load: mockLoad,
}));

const mockFontsAdd = vi.fn();

vi.stubGlobal('FontFace', mockFontFace);
vi.stubGlobal('document', {
  fonts: {
    add: mockFontsAdd,
    load: vi.fn().mockResolvedValue([]),
  },
  createElement: vi.fn().mockReturnValue({ rel: '', href: '', onload: null }),
  head: { appendChild: vi.fn() },
});

// Import after stubbing globals
const { loadFont } = await import('../lib/fontLoader');

describe('fontLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Geist via FontFace API with the local woff2 path', async () => {
    await loadFont('Geist');

    expect(mockFontFace).toHaveBeenCalledWith(
      'Geist',
      'url(/fonts/Geist-Regular.woff2)',
      expect.objectContaining({ weight: '400' }),
    );
    expect(mockLoad).toHaveBeenCalled();
    expect(mockFontsAdd).toHaveBeenCalled();
  });

  it('does not call FontFace for Google Fonts families', async () => {
    await loadFont('Inter');

    // FontFace should NOT be called for Google Fonts path
    expect(mockFontFace).not.toHaveBeenCalled();
  });
});
```

- [ ] Run tests — confirm new tests **fail** (RED):
  ```
  pnpm --filter=web vitest run src/__tests__/fontLoader.test.ts
  ```
  Expected: fails because `loadFont('Geist')` currently falls through to the Google Fonts path (no `LOCAL_FONTS` map yet).

#### Step 3.2 — Implement the fix

- [ ] In `apps/web/src/lib/fontLoader.ts`, add the `LOCAL_FONTS` map above `FONT_CONFIG`:

```ts
const LOCAL_FONTS: Record<string, { src: string; weight: string }> = {
  Geist: { src: '/fonts/Geist-Regular.woff2', weight: '400' },
};
```

- [ ] In `doLoad()`, add the local-font branch at the **top** of the `try` block, before the existing Google Fonts logic:

```ts
async function doLoad(fontFamily: string): Promise<void> {
  try {
    const local = LOCAL_FONTS[fontFamily];
    if (local) {
      const face = new FontFace(fontFamily, `url(${local.src})`, { weight: local.weight });
      await face.load();
      document.fonts.add(face);
      loaded.add(fontFamily);
      return;
    }

    // ... existing Google Fonts path below (unchanged) ...
  } catch {
    loaded.add(fontFamily); // silent fallback — canvas uses sans-serif
  } finally {
    loading.delete(fontFamily); // preserve existing cleanup
  }
}
```

- [ ] Run tests — confirm they **pass** (GREEN):
  ```
  pnpm --filter=web vitest run src/__tests__/fontLoader.test.ts
  ```

- [ ] Commit:
  ```
  git add apps/web/src/lib/fontLoader.ts apps/web/src/__tests__/fontLoader.test.ts
  git commit -m "feat(watermark): add LOCAL_FONTS support to fontLoader — Geist via FontFace API"
  ```

---

### Task 4: Call `loadFont('Geist')` in both encoders

No test required — these are one-line integration additions that wire up the already-tested font loader.

#### Step 4.1 — `videoEncoder.ts`

- [ ] Open `apps/web/src/lib/videoEncoder.ts`
- [ ] Locate the line `await loadFont(style.fontFamily);` (~line 67)
- [ ] Add `await loadFont('Geist');` on the very next line:

```ts
await loadFont(style.fontFamily);
await loadFont('Geist');
```

#### Step 4.2 — `ffmpegEncoder.ts`

- [ ] Open `apps/web/src/lib/ffmpegEncoder.ts`
- [ ] Locate the line `await loadFont(style.fontFamily);` (~line 40)
- [ ] Add `await loadFont('Geist');` on the very next line:

```ts
await loadFont(style.fontFamily);
await loadFont('Geist');
```

- [ ] Commit both encoder changes:
  ```
  git add apps/web/src/lib/videoEncoder.ts apps/web/src/lib/ffmpegEncoder.ts
  git commit -m "feat(watermark): load Geist in both encoders before render loop"
  ```

---

### Task 5: Final verification

- [ ] Run the full web test suite — all tests must pass:
  ```
  pnpm --filter=web test
  ```
  Expected output: all existing tests pass, both new watermark tests pass, new fontLoader tests pass.

- [ ] Run TypeScript strict check — zero errors:
  ```
  pnpm type-check
  ```
  Expected: no errors. (`width` and `height` being unused in `drawWatermark()` is fine — TypeScript does not error on unused parameters in function bodies.)

- [ ] Manual smoke check (optional, no browser automation):
  - Confirm `apps/web/public/fonts/Geist-Regular.woff2` exists and is non-zero.
  - Confirm `drawWatermark()` in `frameRenderer.ts` no longer references `Plus Jakarta Sans`, `Made with Ordio`, or `arc`.
  - Confirm `LOCAL_FONTS` in `fontLoader.ts` maps `'Geist'` to `'/fonts/Geist-Regular.woff2'`.
  - Confirm both encoders call `await loadFont('Geist')` after `await loadFont(style.fontFamily)`.

- [ ] Tag the completion with a summary commit if any loose files remain unstaged:
  ```
  git status
  ```
  If clean: done. If anything unstaged: stage and commit with:
  ```
  git commit -m "feat(watermark): update to 'Ordio by Kaine Studio', Geist font, top-left position"
  ```

---

## Change Summary

| File | Change |
|---|---|
| `apps/web/src/lib/frameRenderer.ts` | Replace `drawWatermark()` body — new text, font, position, no circle |
| `apps/web/src/__tests__/frameRenderer.test.ts` | Two new tests: watermark rendered correctly / not rendered when off |
| `apps/web/package.json` | Add `geist` dependency |
| `pnpm-lock.yaml` | Updated by pnpm |
| `apps/web/public/fonts/Geist-Regular.woff2` | New — copied from geist package |
| `apps/web/src/lib/fontLoader.ts` | Add `LOCAL_FONTS` map + local-font branch in `doLoad()` |
| `apps/web/src/__tests__/fontLoader.test.ts` | New — two tests for local font loading path |
| `apps/web/src/lib/videoEncoder.ts` | Add `await loadFont('Geist')` after existing font load |
| `apps/web/src/lib/ffmpegEncoder.ts` | Add `await loadFont('Geist')` after existing font load |

**Total new tests:** 4 (2 in frameRenderer.test.ts, 2 in fontLoader.test.ts)
**Files modified:** 4 existing + 4 new/added
**Scope:** self-contained — no changes to `FrameOptions`, `renderFrame()`, `page.tsx`, or `useVideoExporter`
