# Studio Branch → `packages/engine` Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `main` (which contains the `packages/engine` extraction + video-backgrounds feature + export-screen work) into `worktree-studio-desktop-spec` so the desktop studio feature sits on the current, sanctioned repo structure, with zero behavior loss on either side.

**Architecture:** `git merge main` into the current branch, resolve the real conflict surface (identified below via full diff analysis — not discovered live), then a small follow-up commit for one import path that main's merge can't auto-fix because the file is new to this branch. No rebase, no force-push, no history rewrite.

**Tech Stack:** git, pnpm workspaces, TypeScript, vitest.

## Global Constraints

- Do not rebase or force-push. This branch backs open PR #13.
- The mobile `/create` flow must remain provably unaffected — verify by exercising it, not just by typecheck.
- `packages/engine` internal cross-imports use relative paths (`../video/textLayout`, `./shared`, etc.), never the `@Ordio/engine` alias — that alias is for consumers outside the package (confirmed via `packages/engine/src/video/frameRenderer.ts` on `main`).
- Package name is `@Ordio/engine` (capital O), matching the existing `@Ordio/shared` / `@Ordio/convex` convention — not `@ordio/engine`.

## Known Conflict Surface (from `git diff` analysis against merge-base `49adf84`)

| File | Nature | Resolution |
|---|---|---|
| `apps/web/src/lib/loaders/fontLoader.ts` → `packages/engine/src/loaders/fontLoader.ts` | Pure move on main; we added a call. | Reapply our addition at new path, fix one import. |
| `apps/web/src/lib/video/textLayout.ts` → `packages/engine/src/video/textLayout.ts` | Pure move on main; we added a cache. | Reapply our addition at new path, no import changes needed. |
| `apps/web/src/lib/processing/captions/phrase.ts` → `packages/engine/src/processing/captions/phrase.ts` | Main only changed import paths; we rewrote the layout logic (word-wrap instead of shrink-to-fit). | Take our body, main's import style. |
| `apps/web/src/lib/processing/captions/shared.ts` → `packages/engine/src/processing/captions/shared.ts` | Main only changed import paths; we added a margin-ratio const. | Take our body, main's import style. |
| `apps/web/src/components/primitives/video/CanvasPreview.tsx` | Main extracted interaction logic into a new `useCaptionGesture.ts` hook (byte-identical extraction); we modified that same logic in place. | Move our 3 behavioral changes into `useCaptionGesture.ts`; take main's `CanvasPreview.tsx` as-is. |
| `apps/web/src/app/studio/{page,layout}.tsx` | Main scaffolded an empty "coming soon" shell; we built the real feature on top. | Our version wins entirely. |
| `apps/web/src/components/soul/states/ExportState/index.tsx` | Main added a creator feature-gate check for video-background export; we added the export-overlay UI + `ExportHeader` prop rename. Real two-sided conflict. | Combine per user decision: gate check runs first and bails via `onLocked` before `onExportStart()`; overlay logic unchanged after that point. |
| `apps/web/src/lib/variants.ts` | Main added 19 lines, we changed 52 (edits, not just additions), same file. | Verify during merge — likely low-risk (CVA variants are independent blocks) but not pre-verified; resolve conflicts by keeping both sides' variants. |
| `apps/web/src/hooks/studio/useSessionHydration.ts` | New file on this branch only; imports `@/lib/media`, which moved. | One-line import fix, no merge conflict (file doesn't exist on main). |

Everything else under the moved directories (`video/`, `waveforms/`, `captions/`, `backgrounds/`, `media/`, `processing/`, `loaders/`, `graphic.ts`, `webgl-detect.ts`) is untouched by this branch and will be silently replaced by main's version via the merge — no action needed.

---

### Task 1: Merge `main` and resolve the engine-package file conflicts

**Files:**
- Modify (via merge): all of `packages/engine/src/**` (new from main), `apps/web/src/lib/**` (directories removed by main)
- Resolve: `packages/engine/src/loaders/fontLoader.ts`, `packages/engine/src/video/textLayout.ts`, `packages/engine/src/processing/captions/phrase.ts`, `packages/engine/src/processing/captions/shared.ts`

**Interfaces:**
- Produces: `invalidateTextMeasureCache()` exported from `packages/engine/src/video/textLayout.ts`, consumed by `packages/engine/src/loaders/fontLoader.ts`.

- [ ] **Step 1: Attempt the merge**

```bash
git fetch origin main
git merge main
```

Expect git to pause on conflicts (or auto-resolve some via rename detection — either is fine, Steps 2-5 make the end state deterministic regardless).

- [ ] **Step 2: Ensure `packages/engine/src/loaders/fontLoader.ts` matches this exact content**

If git left this file conflicted or resolved it incorrectly, its final content must be:

```typescript
/**
 * Loads Google Fonts dynamically so canvas can use them.
 * Fonts are cached — each font is only fetched once per session.
 */

import { invalidateTextMeasureCache } from '../video/textLayout';

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

const LOCAL_FONTS: Record<string, { src: string; weight: string }> = {
  Geist: { src: '/fonts/Geist-Regular.woff2', weight: '400' },
};

const FONT_CONFIG: Record<string, string> = {
  Inter: 'Inter:wght@300;400;600;700',
  Roboto: 'Roboto:wght@300;400;500;700',
  Outfit: 'Outfit:wght@300;400;600;700',
  Poppins: 'Poppins:wght@300;400;600;700',
  Montserrat: 'Montserrat:wght@300;400;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@300;400;600;700',
  'DM Sans': 'DM+Sans:wght@300;400;600;700',
  'Playfair Display': 'Playfair+Display:wght@300;400;600;700',
  Lora: 'Lora:wght@400;500;600;700',
};

const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();
const stylesheetLoading = new Map<string, Promise<void>>();

export async function loadFont(fontFamily: string): Promise<void> {
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
      const face = new FontFace(fontFamily, `url(${local.src})`, { weight: local.weight });
      await face.load();
      document.fonts.add(face);
      loaded.add(fontFamily);
      invalidateTextMeasureCache();
      return;
    }

    const spec = FONT_CONFIG[fontFamily];
    if (!spec) return;

    await ensureGoogleFontStylesheet(fontFamily, spec);

    // Wait for the actual faces we use in canvas rendering.
    await Promise.all([
      document.fonts.load(`400 72px "${fontFamily}"`),
      document.fonts.load(`600 72px "${fontFamily}"`),
    ]);
    await document.fonts.ready;
    loaded.add(fontFamily);
    invalidateTextMeasureCache();
  } catch {
    // Silently fall back — canvas will use sans-serif
    loaded.add(fontFamily);
  } finally {
    loading.delete(fontFamily);
  }
}

function ensureGoogleFontStylesheet(fontFamily: string, spec: string): Promise<void> {
  const existing = stylesheetLoading.get(fontFamily);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const linkId = `gfont-${fontFamily}`;
    const existingLink = document.getElementById(linkId) as HTMLLinkElement | null;

    if (existingLink) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `${GOOGLE_FONTS_CSS}?family=${encodeURIComponent(spec)}&display=swap`;

    const handleLoad = () => {
      link.dataset.loaded = 'true';
      resolve();
    };
    const handleError = () => resolve();

    link.onload = handleLoad;
    link.onerror = handleError;

    document.head.appendChild(link);
  }).finally(() => {
    stylesheetLoading.delete(fontFamily);
  });

  stylesheetLoading.set(fontFamily, promise);
  return promise;
}
```

- [ ] **Step 3: Ensure `packages/engine/src/video/textLayout.ts` matches this exact content**

```typescript
type CanvasTextContext = CanvasRenderingContext2D & {
  letterSpacing?: string;
};

function supportsCanvasLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx;
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function pairSpacing(
  ctx: CanvasRenderingContext2D,
  currentChar: string,
  nextChar: string | undefined,
  characterSpacing: number
): number {
  if (!nextChar || isWhitespace(currentChar) || isWhitespace(nextChar)) return 0;
  if (characterSpacing >= 0) return characterSpacing;

  const currentWidth = ctx.measureText(currentChar).width;
  const nextWidth = ctx.measureText(nextChar).width;
  const maxTightening = Math.min(currentWidth, nextWidth) * 0.45;
  return Math.max(characterSpacing, -maxTightening);
}

// Text measurement is on the render hot path — the preview measures the same
// phrase strings every animation frame (and per character on the fallback
// path). Widths only depend on font + spacing + text, so memoize them.
const measureCache = new Map<string, number>();
const MEASURE_CACHE_MAX = 2000;

/**
 * Widths measured before a web font finishes loading are wrong once the real
 * glyphs arrive (the ctx.font string is identical either way). Font loaders
 * must call this after a face loads.
 */
export function invalidateTextMeasureCache(): void {
  measureCache.clear();
}

export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  characterSpacing = 0
): number {
  if (text.length === 0) return 0;

  const cacheKey = `${ctx.font}|${characterSpacing}|${text}`;
  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let width: number;
  if (characterSpacing === 0) {
    width = ctx.measureText(text).width;
  } else if (supportsCanvasLetterSpacing(ctx)) {
    ctx.save();
    (ctx as CanvasTextContext).letterSpacing = `${characterSpacing}px`;
    width = ctx.measureText(text).width;
    ctx.restore();
  } else {
    const chars = [...text];
    width = 0;
    for (let i = 0; i < chars.length; i++) {
      width += ctx.measureText(chars[i]).width;
      width += pairSpacing(ctx, chars[i], chars[i + 1], characterSpacing);
    }
    width = Math.max(0, width);
  }

  if (measureCache.size >= MEASURE_CACHE_MAX) measureCache.clear();
  measureCache.set(cacheKey, width);
  return width;
}

interface DrawSpacedTextOptions {
  textAlign?: CanvasTextAlign;
  mode?: 'fill' | 'stroke';
  characterSpacing?: number;
}

export function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawSpacedTextOptions = {}
): void {
  const {
    textAlign = 'left',
    mode = 'fill',
    characterSpacing = 0,
  } = options;

  if (text.length === 0) return;

  if (characterSpacing === 0) {
    if (mode === 'stroke') {
      ctx.strokeText(text, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    return;
  }

  if (supportsCanvasLetterSpacing(ctx)) {
    ctx.save();
    ctx.textAlign = textAlign;
    (ctx as CanvasTextContext).letterSpacing = `${characterSpacing}px`;
    if (mode === 'stroke') {
      ctx.strokeText(text, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
    return;
  }

  const totalWidth = measureTextWidth(ctx, text, characterSpacing);
  let cursorX = x;

  if (textAlign === 'center') {
    cursorX -= totalWidth / 2;
  } else if (textAlign === 'right' || textAlign === 'end') {
    cursorX -= totalWidth;
  }

  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (mode === 'stroke') {
      ctx.strokeText(char, cursorX, y);
    } else {
      ctx.fillText(char, cursorX, y);
    }
    cursorX += ctx.measureText(char).width + pairSpacing(ctx, char, chars[i + 1], characterSpacing);
  }
}
```

- [ ] **Step 4: Ensure `packages/engine/src/processing/captions/shared.ts` matches this exact content**

Take our current file's body (the `CAPTION_SIDE_MARGIN_RATIO` addition and the updated `getMaxCaptionTextWidth`), with imports changed to main's relative style:

```typescript
import type { CanvasLayout, CaptionAnimation, CaptionGroup } from '../../types';
import {
  GAP_ABOVE_WAVEFORM,
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
} from '../../waveforms/constants';

export const CAPTION_SIDE_MARGIN_PX = 2;
/** Phrase captions keep a real safe margin so text never runs edge-to-edge. */
export const CAPTION_SIDE_MARGIN_RATIO = 0.06;
export const CAPTION_VERTICAL_SAFE_RATIO = 0.08;
export const FONT_WEIGHT = '600';
export const MIN_CAPTION_SAFE_ZONE = 0.02;
export const PHRASE_FADE_DURATION = 0.15;
export const PHRASE_TOP_RATIO = 0.18;
export const PHRASE_TOP_WITH_VISUAL_RATIO = 0.14;
export const STACK_COLUMN_RATIO = 1.22;
export const STACK_LEFT_RATIO = 0.083;
export const STACK_TOP_RATIO = 0.135;
export const STACK_LINE_HEIGHT_RATIO = 1.18;
export const STACK_TARGET_WORDS_PER_LINE = 7;
export const SUPPORTING_ALPHA = 0.22;
export const SUPPORTING_SCALE = 0.78;
export const SPOTLIGHT_WIDTH_RATIO = 0.86;
export const SPOTLIGHT_TOP_RATIO = 0.2;
export const SPOTLIGHT_WITH_VISUAL_RATIO = 0.14;
```

(rest of the file — the interfaces and functions below `getMaxCaptionTextWidth` — are untouched by either side; keep them as-is from whichever version git produced, they're identical on both sides.)

Then update just `getMaxCaptionTextWidth`:

```typescript
export function getMaxCaptionTextWidth(width: number): number {
  const padding = Math.min(
    Math.max(CAPTION_SIDE_MARGIN_PX, width * CAPTION_SIDE_MARGIN_RATIO),
    width / 2
  );
  return width - padding * 2;
}
```

- [ ] **Step 5: Ensure `packages/engine/src/processing/captions/phrase.ts` matches this exact content**

```typescript
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type {
  CanvasLayout,
  CaptionAnimation,
  CaptionGroup,
  CaptionTransform,
} from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { wrapText } from './wrapText';
import {
  buildOneLinePhraseSegments,
  findActiveDisplaySegment,
} from '../../captions/display';
import {
  calculatePhraseTextY,
  FONT_WEIGHT,
  getMaxCaptionTextWidth,
  hasPulse,
  PHRASE_FADE_DURATION,
  type PhraseCaptionMetrics,
} from './shared';

function getPhraseTransition(
  ctx: CanvasRenderingContext2D,
  transcript: Word[],
  currentTime: number,
  maxWidth: number,
  characterSpacing: number,
  groups?: CaptionGroup[]
): { currentText: string; prevText: string; progress: number; groupIndex: number } {
  if (groups && groups.length > 0) {
    const currentGroupIdx = groups.findIndex(
      (group) => currentTime >= group.start && currentTime < group.end
    );

    if (currentGroupIdx >= 0) {
      return {
        currentText: groups[currentGroupIdx].text,
        prevText: '',
        progress: 1,
        groupIndex: currentGroupIdx,
      };
    }

    const nextGroupIdx = groups.findIndex((group) => group.start > currentTime);
    if (nextGroupIdx > 0) {
      return {
        currentText: '',
        prevText: groups[nextGroupIdx - 1].text,
        progress: 1,
        groupIndex: -1,
      };
    }

    if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
      return {
        currentText: '',
        prevText: groups[groups.length - 1].text,
        progress: 1,
        groupIndex: -1,
      };
    }

    return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
  }

  const segments = buildOneLinePhraseSegments(
    transcript,
    (text) => measureTextWidth(ctx, text, characterSpacing),
    maxWidth
  );
  const activeSegment = findActiveDisplaySegment(segments, currentTime);
  const currentIdx = activeSegment ? segments.indexOf(activeSegment) : -1;

  if (activeSegment && currentIdx >= 0) {
    const progress = Math.min(
      1,
      Math.max(0, (currentTime - activeSegment.start) / PHRASE_FADE_DURATION)
    );
    return {
      currentText: activeSegment.text,
      prevText: progress < 1 && currentIdx > 0 ? segments[currentIdx - 1].text : '',
      progress,
      groupIndex: currentIdx,
    };
  }

  if (transcript.length > 0 && currentTime >= transcript[transcript.length - 1].end) {
    const last = segments[segments.length - 1];
    return {
      currentText: '',
      prevText: last?.text ?? '',
      progress: 1,
      groupIndex: -1,
    };
  }

  return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
}

/**
 * Lays out a phrase caption at a FIXED font size, wrapping into lines instead
 * of shrinking to fit the canvas width. Font size stays constant across short
 * and long groups — a two-word phrase and a four-line sentence render at the
 * same scale, so the video doesn't pump between tiny and huge text.
 * `fitScale` only drops below 1 for a single unbreakable over-wide word.
 */
function layoutPhraseLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: StyleConfig
): { lines: string[]; blockWidth: number; blockHeight: number; lineHeight: number; fitScale: number } {
  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const lines = wrapText(ctx, text, maxTextWidth, characterSpacing);
  const blockWidth = Math.max(
    0,
    ...lines.map((line) => measureTextWidth(ctx, line, characterSpacing))
  );
  const blockHeight = Math.max(lineHeight, lines.length * lineHeight);

  return {
    lines,
    blockWidth,
    blockHeight,
    lineHeight,
    fitScale: blockWidth > 0 ? Math.min(1, maxTextWidth / blockWidth) : 1,
  };
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[],
  animation: CaptionAnimation = 'sweep-pulse',
  captionTransform?: CaptionTransform
): void {
  if (transcript.length === 0) return;
  if (captionTransform && !captionTransform.visible) return;

  const {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing = 0,
  } = style;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(width);
  const transition = getPhraseTransition(
    ctx,
    transcript,
    currentTime,
    maxTextWidth,
    characterSpacing,
    groups
  );
  if (!transition.currentText && !transition.prevText) return;

  const text = transition.currentText || transition.prevText;

  ctx.textAlign = 'center';
  const centerX = width / 2;
  const pulseScale = hasPulse(animation)
    ? 1 + 0.035 * Math.sin(Math.min(1, transition.progress) * Math.PI)
    : 1;

  const renderText = (textToRender: string, alpha: number) => {
    const { lines, blockWidth, blockHeight, lineHeight, fitScale } = layoutPhraseLines(
      ctx,
      textToRender,
      style
    );
    const textY = calculatePhraseTextY(height, layout, hasVisualZone, flipped, blockHeight);
    // Even mid-pulse, the widest line must stay inside the safe width.
    const maxScaleForWidth = blockWidth > 0 ? maxTextWidth / blockWidth : 1;
    const constrainedScale = Math.min(fitScale * pulseScale, maxScaleForWidth);

    ctx.save();
    ctx.globalAlpha = alpha;
    const blockCenterY = textY + blockHeight / 2;
    const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
    const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
    const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
    const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
    ctx.translate(centerX + offsetX, blockCenterY + offsetY);
    ctx.rotate(rotationRad);
    ctx.scale(constrainedScale * manualScale, constrainedScale * manualScale);
    ctx.translate(-centerX, -blockCenterY);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = Math.max(8, fontSize * 0.12);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.25, fontSize * 0.022);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    lines.forEach((line, i) => {
      const lineY = textY + (i + 0.5) * lineHeight;
      drawSpacedText(ctx, line, centerX, lineY, {
        textAlign: 'center',
        mode: 'stroke',
        characterSpacing,
      });
      ctx.fillStyle = textColor;
      drawSpacedText(ctx, line, centerX, lineY, {
        textAlign: 'center',
        mode: 'fill',
        characterSpacing,
      });
    });
    ctx.restore();
  };

  if (transition.prevText && transition.progress < 1) {
    renderText(transition.prevText, 1 - transition.progress);
  }

  renderText(text, transition.progress);
}

export function measureActivePhraseCaption(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[]
): PhraseCaptionMetrics | null {
  if (transcript.length === 0) return null;

  ctx.font = `${FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const characterSpacing = style.characterSpacing ?? 0;
  const transition = getPhraseTransition(
    ctx,
    transcript,
    currentTime,
    maxTextWidth,
    characterSpacing,
    groups
  );
  const text = transition.currentText || transition.prevText;
  if (!text) return null;

  const { lines, blockWidth, blockHeight, lineHeight, fitScale } = layoutPhraseLines(
    ctx,
    text,
    style
  );
  const textY = calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, blockHeight);

  return {
    text,
    lines,
    centerX: style.width / 2,
    textY,
    lineHeight,
    blockWidth,
    blockHeight,
    blockCenterY: textY + blockHeight / 2,
    fitScale,
  };
}
```

- [ ] **Step 6: Confirm `apps/web/src/app/studio/page.tsx` and `layout.tsx` are our version, not main's placeholder**

```bash
git diff --name-only --diff-filter=U | grep "app/studio" || echo "no conflict — verify content manually"
git show HEAD:apps/web/src/app/studio/page.tsx | head -5
```

If either file shows main's "coming soon" placeholder content instead of our built-out version, restore ours:

```bash
git checkout --ours apps/web/src/app/studio/page.tsx apps/web/src/app/studio/layout.tsx
git add apps/web/src/app/studio/page.tsx apps/web/src/app/studio/layout.tsx
```

- [ ] **Step 7: Stage the resolved engine files**

```bash
git add packages/engine/src/loaders/fontLoader.ts \
        packages/engine/src/video/textLayout.ts \
        packages/engine/src/processing/captions/shared.ts \
        packages/engine/src/processing/captions/phrase.ts
```

Don't commit yet — Tasks 2 and 3 resolve the remaining conflicts before the merge commit lands.

---

### Task 2: Resolve `CanvasPreview.tsx` / `useCaptionGesture.ts`

**Files:**
- Modify: `apps/web/src/components/primitives/video/canvas-preview/useCaptionGesture.ts`
- Verify unchanged from main: `apps/web/src/components/primitives/video/CanvasPreview.tsx`

**Interfaces:**
- Produces: `useCaptionGesture` now accepts an additional `onActivationSingleTap: () => void` prop; `CanvasPreview.tsx` passes its existing `togglePlayback` callback (build it if main's version doesn't already have one — see Step 3).

- [ ] **Step 1: Set `useCaptionGesture.ts` to this exact content**

```typescript
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { CaptionTransform } from '@/stores';
import {
  isCaptionActivationDoubleTap,
  CAPTION_ACTIVATION_DOUBLE_TAP_WINDOW_MS,
  type CaptionActivationTap,
} from './captionActivationGesture';

type GestureMode = 'move' | 'resize' | 'rotate';

interface GestureState {
  mode: GestureMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetXRatio: number;
  startOffsetYRatio: number;
  startScale: number;
  startRotationDeg: number;
}

interface UseCaptionGestureArgs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  captionTransform: CaptionTransform;
  setCaptionTransform: (transform: Partial<CaptionTransform>) => void;
  showCaptionBox: boolean;
  /** Single tap/click over the caption box falls through to this — the
   * activation hotspot sits above the full-canvas play/pause toggle, and
   * only a double tap/click should enter transform mode instead. */
  onActivationSingleTap: () => void;
}

/** Set once the user has entered caption transform mode — the stroke-pulse
 * activation hint stops appearing after that. */
const CAPTION_HINT_SEEN_KEY = 'ordio-caption-edit-hint-seen';

/**
 * Drag-to-move / drag-to-resize / drag-to-rotate for the caption box, plus
 * the double-tap (touch) / double-click (mouse) gesture that activates the
 * transform handles in the first place.
 */
export function useCaptionGesture({
  canvasRef,
  canvasWidth,
  canvasHeight,
  captionTransform,
  setCaptionTransform,
  showCaptionBox,
  onActivationSingleTap,
}: UseCaptionGestureArgs) {
  const [isTransformActive, setIsTransformActive] = useState(false);
  const [showTransformHint, setShowTransformHint] = useState(false);
  const gestureRef = useRef<GestureState | null>(null);
  const activationTapRef = useRef<CaptionActivationTap | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getCanvasDisplaySize = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      width: Math.max(1, rect?.width ?? canvasWidth),
      height: Math.max(1, rect?.height ?? canvasHeight),
    };
  }, [canvasRef, canvasHeight, canvasWidth]);

  const beginGesture = useCallback((mode: GestureMode, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = {
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetXRatio: captionTransform.offsetXRatio,
      startOffsetYRatio: captionTransform.offsetYRatio,
      startScale: captionTransform.scale,
      startRotationDeg: captionTransform.rotationDeg,
    };
  }, [captionTransform]);

  const handleGestureMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    const dx = e.clientX - gesture.startClientX;
    const dy = e.clientY - gesture.startClientY;
    const displaySize = getCanvasDisplaySize();

    if (gesture.mode === 'move') {
      setCaptionTransform({
        offsetXRatio: Math.max(-0.45, Math.min(0.45, gesture.startOffsetXRatio + dx / displaySize.width)),
        offsetYRatio: Math.max(-0.45, Math.min(0.45, gesture.startOffsetYRatio + dy / displaySize.height)),
      });
      return;
    }

    if (gesture.mode === 'resize') {
      const nextScale =
        gesture.startScale +
        (dx / displaySize.width + dy / displaySize.height) * 1.2;
      setCaptionTransform({ scale: Math.max(0.45, Math.min(2.8, nextScale)) });
      return;
    }

    const nextRotation = gesture.startRotationDeg + dx * 0.35;
    setCaptionTransform({ rotationDeg: nextRotation });
  }, [getCanvasDisplaySize, setCaptionTransform]);

  const endGesture = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!showCaptionBox) {
      setIsTransformActive(false);
    }
  }, [showCaptionBox]);

  // One-time affordance: the caption box stroke breathes twice (CSS
  // .caption-hint-pulse) instead of a text banner. Re-shown on later visits
  // until the user actually enters transform mode once, then never again.
  useEffect(() => {
    if (!showCaptionBox || isTransformActive) {
      setShowTransformHint(false);
      return;
    }
    if (localStorage.getItem(CAPTION_HINT_SEEN_KEY)) return;
    setShowTransformHint(true);
    const timer = window.setTimeout(() => setShowTransformHint(false), 3600);
    return () => window.clearTimeout(timer);
  }, [showCaptionBox, isTransformActive]);

  const clearSingleTapTimer = useCallback(() => {
    if (singleTapTimerRef.current !== null) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearSingleTapTimer, [clearSingleTapTimer]);

  const activateTransform = useCallback(() => {
    if (!showCaptionBox) return;
    activationTapRef.current = null;
    clearSingleTapTimer();
    localStorage.setItem(CAPTION_HINT_SEEN_KEY, '1');
    setIsTransformActive(true);
  }, [showCaptionBox, clearSingleTapTimer]);

  // The activation hotspot sits above the full-canvas play/pause toggle, so a
  // single tap/click over the captions must fall through to play/pause — only
  // a double tap/click enters transform mode. We disambiguate with a timer
  // matched to the double-tap window.
  const handleActivationPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const previousTap = activationTapRef.current;
    const nextTap: CaptionActivationTap = {
      timestamp: event.timeStamp,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    activationTapRef.current = nextTap;

    if (isCaptionActivationDoubleTap(previousTap, nextTap)) {
      activateTransform();
      return;
    }

    clearSingleTapTimer();
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      onActivationSingleTap();
    }, CAPTION_ACTIVATION_DOUBLE_TAP_WINDOW_MS);
  }, [activateTransform, clearSingleTapTimer, onActivationSingleTap]);

  const handleActivationDoubleClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activateTransform();
  }, [activateTransform]);

  return {
    isTransformActive,
    setIsTransformActive,
    showTransformHint,
    overlayRef,
    beginGesture,
    handleGestureMove,
    endGesture,
    handleActivationPointerUp,
    handleActivationDoubleClick,
  };
}
```

- [ ] **Step 2: Set `captionActivationGesture.ts`'s exported constant**

This file has zero conflicts (neither side touched the same lines) — confirm it contains, after the existing `DOUBLE_TAP_MAX_DISTANCE_PX` line:

```typescript
/**
 * How long a single tap waits before committing to its action (play/pause
 * fallthrough) — must match the double-tap interval so a second tap inside
 * the window upgrades the gesture instead of firing both actions.
 */
export const CAPTION_ACTIVATION_DOUBLE_TAP_WINDOW_MS = DOUBLE_TAP_MAX_INTERVAL_MS;
```

If git already merged this cleanly (likely), no action needed — just verify with `git show HEAD:apps/web/src/components/primitives/video/canvas-preview/captionActivationGesture.ts | grep CAPTION_ACTIVATION_DOUBLE_TAP_WINDOW_MS`.

- [ ] **Step 3: Wire `togglePlayback` into `CanvasPreview.tsx`**

Take main's `CanvasPreview.tsx` as the base (it should already be conflict-free — we made zero changes outside the interaction logic that moved into the hook). Add a `togglePlayback` callback and pass it to `useCaptionGesture`:

Find:
```typescript
  const { captionBox } = useCanvasRenderLoop({
```

Insert immediately before it:
```typescript
  const togglePlayback = useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else void playback.play();
  }, [playback]);

```

Add `useCallback` to the React import at the top of the file (main's version imports `useRef, useState, useEffect` — add `useCallback`):
```typescript
import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react';
```

Find the `useCaptionGesture` call:
```typescript
  } = useCaptionGesture({
    canvasRef,
    canvasWidth,
    canvasHeight,
    captionTransform,
    setCaptionTransform,
    showCaptionBox,
  });
```

Replace with:
```typescript
  } = useCaptionGesture({
    canvasRef,
    canvasWidth,
    canvasHeight,
    captionTransform,
    setCaptionTransform,
    showCaptionBox,
    onActivationSingleTap: togglePlayback,
  });
```

- [ ] **Step 4: Stage the resolved files**

```bash
git add apps/web/src/components/primitives/video/CanvasPreview.tsx \
        apps/web/src/components/primitives/video/canvas-preview/useCaptionGesture.ts \
        apps/web/src/components/primitives/video/canvas-preview/captionActivationGesture.ts
```

---

### Task 3: Resolve `ExportState/index.tsx`

**Files:**
- Modify: `apps/web/src/components/soul/states/ExportState/index.tsx`

**Interfaces:**
- Consumes: `useFeatureGates()` from `@/hooks/auth/useFeatureGates` (already exists on main — used by `ExportCanvas`/`ExportControls` per the existing `onLocked` prop pattern in this same file).

- [ ] **Step 1: Set the file's imports and top-of-component hooks**

Find:
```typescript
import type { FeatureKey } from '@/lib/featureGates';
import type { Word } from '@Ordio/shared/schemas';
```

Replace with:
```typescript
import type { FeatureKey } from '@/lib/featureGates';
import type { Word } from '@Ordio/shared/schemas';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
```

Find:
```typescript
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [exportOverlayOpen, setExportOverlayOpen] = useState(false);
```

Replace with:
```typescript
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [exportOverlayOpen, setExportOverlayOpen] = useState(false);
  const { isLocked } = useFeatureGates();
```

- [ ] **Step 2: Merge the gate check into `handleExport`, deduping the repeated `useUIStore.getState().style` lookup**

Find:
```typescript
  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return;

    const allowed = await onExportStart();
    if (!allowed) return;

    setExportOverlayOpen(true);

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
```

Replace with (gate check runs before `onExportStart()`, per your decision — gated users never see the overlay open; the `style` lookup that used to happen twice — once implicitly for the gate check, once for the canvas fill — now happens once and is reused):

```typescript
  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return;

    const style = useUIStore.getState().style;

    // Video backgrounds preview free, but export is creator-gated.
    if (style.background?.type === 'video' && isLocked('background_video')) {
      onLocked('background_video');
      return;
    }

    const allowed = await onExportStart();
    if (!allowed) return;

    setExportOverlayOpen(true);

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript);
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript);

    const { width, height } = getCanvasDimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
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
  }, [audioBuffer, transcript, trimmer, format, exporter, showWatermark, onExportStart, isLocked, onLocked]);
```

Everything below this (the `ExportHeader` prop rename, `ExportOverlay` JSX, `ExportFooter`, `DiscardDialog`) is untouched by main and stays exactly as our branch has it — no further changes to this file.

- [ ] **Step 3: Stage the resolved file**

```bash
git add apps/web/src/components/soul/states/ExportState/index.tsx
```

---

### Task 4: Resolve `variants.ts`, verify no other conflicts remain, and complete the merge commit

**Files:**
- Modify (if conflicted): `apps/web/src/lib/variants.ts`

- [ ] **Step 1: Check remaining conflict state**

```bash
git status --short | grep "^UU\|^AA\|^DD"
```

- [ ] **Step 2: If `apps/web/src/lib/variants.ts` is listed, resolve by keeping both sides' variants**

Open the file, find the conflict markers. Main's 19 added lines are new CVA variant exports (additive, for the video-backgrounds picker UI) and our 52-line diff is edits to existing variants elsewhere in the file. Keep both: main's new variant exports, and our edited variants — there is no case where the *same* variant definition was changed by both sides (verify by checking the conflict markers don't wrap the identical variant name on both sides; if they do, stop and flag it rather than guessing).

```bash
git add apps/web/src/lib/variants.ts
```

- [ ] **Step 3: Confirm zero remaining conflicts**

```bash
git status --short | grep "^UU\|^AA\|^DD"
```

Expected: no output.

- [ ] **Step 4: Complete the merge commit**

```bash
git commit -m "merge: bring in packages/engine extraction + video-backgrounds + export work from main

Resolves conflicts in the 4 caption/text-layout engine files (ours: word-wrap
+ measure cache), CanvasPreview/useCaptionGesture (ours: single-tap-to-play
disambiguation + one-time hint persistence, relocated into main's new hook),
and ExportState (main's creator gate + our export overlay UI, gate-check-first
per product decision)."
```

---

### Task 5: Fix the one import broken by the move

**Files:**
- Modify: `apps/web/src/hooks/studio/useSessionHydration.ts:8`

- [ ] **Step 1: Fix the import**

Find:
```typescript
import { decodeBlobToAudioBuffer } from '@/lib/media';
```

Replace with:
```typescript
import { decodeBlobToAudioBuffer } from '@Ordio/engine/media';
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/studio/useSessionHydration.ts
git commit -m "fix(studio): update useSessionHydration import for packages/engine move"
```

---

### Task 6: Verify

**Files:** none (verification only)

- [ ] **Step 1: Install — workspace deps changed (apps/web now depends on `@Ordio/engine`)**

```bash
pnpm install
```

Expected: completes without error, `packages/engine` linked into `apps/web/node_modules/@Ordio/engine`.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit -p .
```

Expected: no errors. If errors reference `@/lib/video`, `@/lib/waveforms`, `@/lib/captions`, `@/lib/backgrounds`, `@/lib/media`, `@/lib/processing`, `@/lib/loaders`, `@/lib/graphic`, or `@/lib/webgl-detect`, one was missed — grep for it and fix (rewrite to `@Ordio/engine/<subpath>`).

- [ ] **Step 3: Run the full test suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass. Pay particular attention to caption/phrase and textLayout tests (`captionModes.test.ts`, `textLayout.test.ts`, `fontLoader.test.ts`) since those exercise the code this plan hand-merged.

- [ ] **Step 4: Manually exercise `/studio` in a browser**

Start the dev server, open `/studio`, record or load a clip, and specifically test:
- Caption box: single tap/click toggles play/pause; double tap/click enters transform mode (this is the exact behavior this plan reconstructed inside `useCaptionGesture.ts`).
- The one-time caption-edit hint appears once, then not again after entering transform mode (check `localStorage.getItem('ordio-caption-edit-hint-seen')` in devtools).
- Export flow completes and the export overlay opens.

- [ ] **Step 5: Manually exercise `/create` (mobile flow) to confirm it's unaffected**

Start the dev server, open `/create`, record a clip end-to-end through export. This flow shares `ExportState`, `CanvasPreview`, and the engine package with `/studio` — confirm nothing regressed.

- [ ] **Step 6: Push**

```bash
git push origin worktree-studio-desktop-spec
```

PR #13 updates automatically with the merge.
