import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform, CaptionMode } from '@/stores';
import {
  measureActivePhraseCaption,
  measureSpotlightCaptionBlock,
  measureStackCaptionBlock,
} from '@/lib/processing/captions';
import { measureKaraokeCaptionBlock } from '@/lib/video/karaoke';

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
  captionMode: CaptionMode;
}

export function measureCaptionTransformBox(
  options: CaptionTransformGeometryOptions
): CaptionTransformBox | null {
  const {
    ctx,
    currentTime,
    transcript,
    captionGroups,
    style,
    layout,
    hasVisualZone,
    flipped,
    transform,
    captionMode,
  } = options;

  if (!transform.visible) return null;

  if (captionMode === 'karaoke') {
    const km = measureKaraokeCaptionBlock(ctx, currentTime, transcript, style, captionGroups);
    if (!km) return null;

    const scale = Math.max(0.4, Math.min(3, transform.scale));
    const width = Math.max(
      MIN_TOUCH_TARGET_PX,
      km.blockWidth * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const height = Math.max(
      MIN_TOUCH_TARGET_PX,
      km.blockHeight * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const centerX = km.centerX + transform.offsetXRatio * style.width;
    const centerY = km.blockCenterY + transform.offsetYRatio * style.height;

    return {
      centerX,
      centerY,
      width,
      height,
      rotationDeg: transform.rotationDeg,
      style: {
        left: `${(centerX / style.width) * 100}%`,
        top: `${(centerY / style.height) * 100}%`,
        width: `${(width / style.width) * 100}%`,
        height: `${(height / style.height) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg)`,
      },
    };
  }

  if (captionMode === 'stack') {
    const metrics = measureStackCaptionBlock(ctx, currentTime, transcript, style, captionGroups);
    if (!metrics) return null;

    const scale = Math.max(0.4, Math.min(3, transform.scale));
    const width = Math.max(
      MIN_TOUCH_TARGET_PX,
      metrics.blockWidth * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const height = Math.max(
      MIN_TOUCH_TARGET_PX,
      metrics.blockHeight * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const centerX = metrics.blockCenterX + transform.offsetXRatio * style.width;
    const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;

    return {
      centerX,
      centerY,
      width,
      height,
      rotationDeg: transform.rotationDeg,
      style: {
        left: `${(centerX / style.width) * 100}%`,
        top: `${(centerY / style.height) * 100}%`,
        width: `${(width / style.width) * 100}%`,
        height: `${(height / style.height) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg)`,
      },
    };
  }

  if (captionMode === 'spotlight') {
    const metrics = measureSpotlightCaptionBlock(
      ctx,
      currentTime,
      transcript,
      style,
      layout,
      hasVisualZone,
      captionGroups
    );
    if (!metrics) return null;

    const scale = Math.max(0.4, Math.min(3, transform.scale));
    const width = Math.max(
      MIN_TOUCH_TARGET_PX,
      metrics.blockWidth * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const height = Math.max(
      MIN_TOUCH_TARGET_PX,
      metrics.blockHeight * scale + CAPTION_TRANSFORM_BREATHING_PX
    );
    const centerX = metrics.centerX + transform.offsetXRatio * style.width;
    const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;

    return {
      centerX,
      centerY,
      width,
      height,
      rotationDeg: transform.rotationDeg,
      style: {
        left: `${(centerX / style.width) * 100}%`,
        top: `${(centerY / style.height) * 100}%`,
        width: `${(width / style.width) * 100}%`,
        height: `${(height / style.height) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg)`,
      },
    };
  }

  const metrics = measureActivePhraseCaption(
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

  const scale = Math.max(0.4, Math.min(3, transform.scale));
  const renderedScale = metrics.fitScale * scale;
  const width = Math.max(
    MIN_TOUCH_TARGET_PX,
    metrics.blockWidth * renderedScale + CAPTION_TRANSFORM_BREATHING_PX
  );
  const height = Math.max(
    MIN_TOUCH_TARGET_PX,
    metrics.blockHeight * renderedScale + CAPTION_TRANSFORM_BREATHING_PX
  );
  const centerX = metrics.centerX + transform.offsetXRatio * style.width;
  const centerY = metrics.blockCenterY + transform.offsetYRatio * style.height;

  return {
    centerX,
    centerY,
    width,
    height,
    rotationDeg: transform.rotationDeg,
    style: {
      left: `${(centerX / style.width) * 100}%`,
      top: `${(centerY / style.height) * 100}%`,
      width: `${(width / style.width) * 100}%`,
      height: `${(height / style.height) * 100}%`,
      transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg)`,
    },
  };
}
