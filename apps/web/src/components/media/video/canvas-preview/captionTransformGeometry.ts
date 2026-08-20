import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '@/stores';
import { measureCaptionBlockRect } from '@Ordio/engine/processing/captions';

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

/**
 * The draggable frame around the captions, as CSS percentages.
 *
 * The per-mechanic measurement this used to own now lives in the engine
 * (`measureCaptionBlockRect`) so the renderer can use it too — it needs the
 * same rect to paint the caption background behind the words. What stays here
 * is the part that is only true of a *touch target*: breathing room so the
 * frame does not hug the glyphs, a 44px floor, and the percentage conversion
 * the overlay positions itself with.
 */
export function measureCaptionTransformBox(
  options: CaptionTransformGeometryOptions
): CaptionTransformBox | null {
  const rect = measureCaptionBlockRect(options);
  if (!rect) return null;

  const { style } = options;
  const width = Math.max(MIN_TOUCH_TARGET_PX, rect.width + CAPTION_TRANSFORM_BREATHING_PX);
  const height = Math.max(MIN_TOUCH_TARGET_PX, rect.height + CAPTION_TRANSFORM_BREATHING_PX);

  return {
    centerX: rect.centerX,
    centerY: rect.centerY,
    width,
    height,
    rotationDeg: rect.rotationDeg,
    style: {
      left: `${(rect.centerX / style.width) * 100}%`,
      top: `${(rect.centerY / style.height) * 100}%`,
      width: `${(width / style.width) * 100}%`,
      height: `${(height / style.height) * 100}%`,
      transform: `translate(-50%, -50%) rotate(${rect.rotationDeg}deg)`,
    },
  };
}
