import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '@/stores';
import { measureActivePhraseCaption } from '@/lib/processing/captions';

const MIN_TOUCH_TARGET_PX = 44;

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
  } = options;

  if (!transform.visible) return null;

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
  const width = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockWidth * renderedScale);
  const height = Math.max(MIN_TOUCH_TARGET_PX, metrics.blockHeight * renderedScale);
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
