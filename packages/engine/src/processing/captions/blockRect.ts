import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '../../types';
import { getCaptionStylePreset } from '../../captions/presets';
import { scaleAboutPivot } from './shared';
import { measureWordSwapCaptionBlock } from './wordSwap';
import { measurePhraseCutCaptionBlock } from './phraseCut';
import { measureStaticHighlightCaptionBlock } from './staticHighlight';
import { measureProgressiveRevealCaptionBlock } from './progressiveReveal';

/** The caption block as it lands on the canvas, user transform included. */
export interface CaptionBlockRect {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
}

export interface CaptionBlockRectOptions {
  ctx: CanvasRenderingContext2D;
  currentTime: number;
  transcript: Word[];
  captionGroups?: CaptionGroup[];
  style: StyleConfig;
  layout: CanvasLayout;
  hasVisualZone: boolean;
  flipped: boolean;
  transform?: CaptionTransform;
}

const MIN_MANUAL_SCALE = 0.4;
const MAX_MANUAL_SCALE = 3;

/**
 * Where the caption block sits, in canvas coordinates, after both the
 * mechanic's own layout scaling and the user's manual transform.
 *
 * Two callers need this and used to have only one of them: the preview's
 * drag/resize frame computed it in the web app, while the renderer had no way
 * to know where captions were and so could not draw anything behind them.
 * Living in the engine means preview and export agree by construction.
 *
 * The per-mechanic asymmetry is deliberate and load-bearing. static-highlight
 * and progressive-reveal return bounds with their layout scale already applied
 * — `centerX` is pre-pivoted and `blockWidth` pre-multiplied — so only the
 * manual scale goes on top. word-swap and phrase-cut return unscaled bounds
 * plus a `fitScale` that has to be combined with it. Getting this backwards
 * puts the box in roughly the right place at scale 1 and nowhere near it
 * otherwise.
 */
export function measureCaptionBlockRect(
  options: CaptionBlockRectOptions
): CaptionBlockRect | null {
  const { ctx, currentTime, transcript, captionGroups, style, layout, hasVisualZone, flipped } =
    options;
  const transform = options.transform;

  if (transform && !transform.visible) return null;

  const manualScale = Math.max(
    MIN_MANUAL_SCALE,
    Math.min(MAX_MANUAL_SCALE, transform?.scale ?? 1)
  );
  const offsetX = (transform?.offsetXRatio ?? 0) * style.width;
  const offsetY = (transform?.offsetYRatio ?? 0) * style.height;
  const rotationDeg = transform?.rotationDeg ?? 0;
  const mechanic = getCaptionStylePreset(style.captionStyleId).mechanic;

  const place = (
    centerX: number,
    blockCenterY: number,
    blockWidth: number,
    blockHeight: number,
    pivotX: number,
    effectiveScale: number
  ): CaptionBlockRect => ({
    // The block scales about pivotX, so a start/end-aligned caption's centre
    // moves under manual scale — following it keeps anything anchored to the
    // block on the text.
    centerX: scaleAboutPivot(centerX, pivotX, effectiveScale) + offsetX,
    centerY: blockCenterY + offsetY,
    width: blockWidth * effectiveScale,
    height: blockHeight * effectiveScale,
    rotationDeg,
  });

  if (mechanic === 'static-highlight' || mechanic === 'progressive-reveal') {
    const metrics =
      mechanic === 'static-highlight'
        ? measureStaticHighlightCaptionBlock(ctx, currentTime, transcript, style, captionGroups)
        : measureProgressiveRevealCaptionBlock(
            ctx,
            currentTime,
            transcript,
            style,
            layout,
            hasVisualZone,
            flipped,
            captionGroups
          );
    if (!metrics) return null;
    // Layout scale is already inside these bounds.
    return place(
      metrics.centerX,
      metrics.blockCenterY,
      metrics.blockWidth,
      metrics.blockHeight,
      metrics.pivotX,
      manualScale
    );
  }

  const metrics =
    mechanic === 'word-swap'
      ? measureWordSwapCaptionBlock(
          ctx,
          currentTime,
          transcript,
          style,
          layout,
          hasVisualZone,
          flipped,
          captionGroups
        )
      : measurePhraseCutCaptionBlock(
          ctx,
          currentTime,
          transcript,
          style,
          layout,
          hasVisualZone,
          flipped,
          captionGroups
        );
  if (!metrics) return null;

  return place(
    metrics.centerX,
    metrics.blockCenterY,
    metrics.blockWidth,
    metrics.blockHeight,
    metrics.pivotX,
    metrics.fitScale * manualScale
  );
}
