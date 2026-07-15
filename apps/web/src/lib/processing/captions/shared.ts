import type { CanvasLayout, CaptionAnimation, CaptionGroup } from '@/stores';
import {
  GAP_ABOVE_WAVEFORM,
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
} from '@/lib/waveforms/constants';

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

export interface PhraseCaptionMetrics {
  text: string;
  lines: string[];
  centerX: number;
  textY: number;
  lineHeight: number;
  blockWidth: number;
  blockHeight: number;
  blockCenterY: number;
  fitScale: number;
}

export interface StackCaptionMetrics {
  lines: string[];
  blockLeft: number;
  blockTop: number;
  blockCenterY: number;
  blockCenterX: number;
  blockWidth: number;
  blockHeight: number;
  lineHeight: number;
}

export interface SpotlightCaptionMetrics {
  centerX: number;
  centerY: number;
  blockCenterY: number;
  blockWidth: number;
  blockHeight: number;
}

export function hasPulse(animation: CaptionAnimation): boolean {
  return animation === 'pulse' || animation === 'sweep-pulse';
}

export function getMaxCaptionTextWidth(width: number): number {
  const padding = Math.min(
    Math.max(CAPTION_SIDE_MARGIN_PX, width * CAPTION_SIDE_MARGIN_RATIO),
    width / 2
  );
  return width - padding * 2;
}

export function calculatePhraseTextY(
  height: number,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped: boolean,
  blockHeight: number
): number {
  const safePad = height * CAPTION_VERTICAL_SAFE_RATIO;

  if (!hasVisualZone) {
    return Math.max(safePad, height * PHRASE_TOP_RATIO);
  }

  if (!flipped) {
    const waveformTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
    const captionBottom = waveformTop - height * GAP_ABOVE_WAVEFORM;
    const maxTextY = captionBottom - height * MIN_CAPTION_SAFE_ZONE - blockHeight;
    const preferredY =
      layout === 'top'
        ? height * PHRASE_TOP_WITH_VISUAL_RATIO
        : layout === 'compact'
          ? height * (PHRASE_TOP_WITH_VISUAL_RATIO + 0.04)
          : height * 0.2;
    return Math.max(Math.min(preferredY, maxTextY), safePad);
  }

  const waveformBottom = WAVEFORM_CENTER_Y_FLIPPED * height + height * WAVEFORM_MAX_AMP;
  const captionTop = waveformBottom + height * GAP_ABOVE_WAVEFORM;
  const captionBottom = height - safePad;
  const textY =
    layout === 'compact'
      ? captionTop
      : Math.max(captionTop, captionTop + (captionBottom - captionTop - blockHeight) / 2);
  return Math.min(textY, captionBottom - blockHeight);
}

export function getSpotlightCenterY(
  height: number,
  lineHeight: number,
  layout: CanvasLayout,
  hasVisualZone: boolean
): number {
  if (!hasVisualZone) return height * SPOTLIGHT_TOP_RATIO;

  const visualTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
  const captionBottom = visualTop - height * GAP_ABOVE_WAVEFORM;
  const preferredY =
    layout === 'compact'
      ? height * (SPOTLIGHT_WITH_VISUAL_RATIO + 0.04)
      : height * SPOTLIGHT_WITH_VISUAL_RATIO;
  return Math.min(preferredY, captionBottom - lineHeight);
}

export function getActiveCaptionGroup(
  groups: CaptionGroup[],
  currentTime: number
): CaptionGroup | null {
  const activeGroup = groups.find((group) => currentTime >= group.start && currentTime < group.end);
  if (activeGroup) return activeGroup;

  const nextGroupIndex = groups.findIndex((group) => group.start > currentTime);
  if (nextGroupIndex > 0) return groups[nextGroupIndex - 1];
  if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
    return groups[groups.length - 1];
  }

  return null;
}
