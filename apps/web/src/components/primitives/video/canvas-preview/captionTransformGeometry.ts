import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '@/stores';
import {
  measureWordSwapCaptionBlock,
  measurePhraseCutCaptionBlock,
  measureStaticHighlightCaptionBlock,
  measureProgressiveRevealCaptionBlock,
  scaleAboutPivot,
} from '@Ordio/engine/processing/captions';
import { getCaptionStylePreset } from '@Ordio/engine';

const MIN_TOUCH_TARGET_PX = 44;
/** Extra padding around measured caption bounds so the transform frame does not hug glyphs. */
const CAPTION_TRANSFORM_BREATHING_PX = 18;

export interface CaptionTransformBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    transform: string;
  };
}

export interface CaptionTransformGeometryOptions {
  ctx: CanvasRenderingContext2D;
  currentTime: number;
  transcript: Word[];
  captionGroups: CaptionGroup[];
  style: StyleConfig;
  layout: CanvasLayout;
  hasVisualZone: boolean;
  flipped: boolean;
  transform: CaptionTransform;
}

function boxFromCenter(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationDeg: number,
  canvasWidth: number,
  canvasHeight: number
): CaptionTransformBox {
  return {
    centerX,
    centerY,
    width,
    height,
    rotationDeg,
    style: {
      left: `${(centerX / canvasWidth) * 100}%`,
      top: `${(centerY / canvasHeight) * 100}%`,
      width: `${(width / canvasWidth) * 100}%`,
      height: `${(height / canvasHeight) * 100}%`,
      transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
    },
  };
}

export function measureCaptionTransformBox(
  options: CaptionTransformGeometryOptions
): CaptionTransformBox | null {
  const { ctx, currentTime, transcript, captionGroups, style, layout, hasVisualZone, flipped, transform } = options;

  if (!transform.visible) return null;

  const scale = Math.max(0.4, Math.min(3, transform.scale));
  const mechanic = getCaptionStylePreset(style.captionStyleId).mechanic;

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

    const width = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockWidth * scale + CAPTION_TRANSFORM_BREATHING_PX);
    const height = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockHeight * scale + CAPTION_TRANSFORM_BREATHING_PX);
    // The block scales about pivotX, so a start/end-aligned caption's center
    // moves under manual scale — following it keeps the drag box on the text.
    const centerX =
      scaleAboutPivot(metrics.centerX, metrics.pivotX, scale) + transform.offsetXRatio * style.width;
    const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;
    return boxFromCenter(centerX, centerY, width, height, transform.rotationDeg, style.width, style.height);
  }

  if (mechanic === 'word-swap') {
    const metrics = measureWordSwapCaptionBlock(
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

    const renderedScale = metrics.fitScale * scale;
    const width = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockWidth * renderedScale + CAPTION_TRANSFORM_BREATHING_PX);
    const height = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockHeight * renderedScale + CAPTION_TRANSFORM_BREATHING_PX);
    const centerX =
      scaleAboutPivot(metrics.centerX, metrics.pivotX, renderedScale) + transform.offsetXRatio * style.width;
    const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;
    return boxFromCenter(centerX, centerY, width, height, transform.rotationDeg, style.width, style.height);
  }

  const metrics = measurePhraseCutCaptionBlock(
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

  const renderedScale = metrics.fitScale * scale;
  const width = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockWidth * renderedScale + CAPTION_TRANSFORM_BREATHING_PX);
  const height = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockHeight * renderedScale + CAPTION_TRANSFORM_BREATHING_PX);
  const centerX =
    scaleAboutPivot(metrics.centerX, metrics.pivotX, renderedScale) + transform.offsetXRatio * style.width;
  const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;
  return boxFromCenter(centerX, centerY, width, height, transform.rotationDeg, style.width, style.height);
}
