import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, CaptionMode, CaptionAnimation, GraphicStyleId, CanvasLayout, CaptionTransform } from '@/stores';
import type { CaptionGroup } from '@/stores/types';
import { drawPillBars, drawCircleWaveform, drawSpectrogram } from '@/lib/waveforms';
import { WAVEFORM_CENTER_Y_FLIPPED, CIRCLE_CENTER_Y_FLIPPED } from '@/lib/waveforms/constants';
import { getGraphic } from '../loaders/graphicLoader';
import { drawGraphic } from '../graphic';
import { drawCaptions } from '../processing/captions';
import { drawKaraokeCaptions } from './karaoke';
import { drawWatermark } from '../processing/watermark';

export interface FrameOptions {
  waveformData: number[];
  transcript: Word[];
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  captionAnimation?: CaptionAnimation;
  canvasLayout?: CanvasLayout;
  showWatermark?: boolean;
  graphicStyle?: GraphicStyleId;
  /** Editorial caption groups from processingStore. Falls back to auto-phrase grouping if omitted. */
  captionGroups?: CaptionGroup[];
  captionTransform?: CaptionTransform;
}

/**
 * Renders a single video frame to a canvas context.
 * Pure function — no React, no side effects.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  frameIndex: number,
  totalFrames: number,
  options: FrameOptions
): void {
  const {
    waveformData,
    transcript,
    style,
    waveformStyle,
    captionMode,
    captionAnimation,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionGroups,
    captionTransform,
  } = options;
  const { width, height } = style;
  const currentTime = frameIndex / FPS;
  const duration = totalFrames / FPS;
  const layout = canvasLayout ?? 'top';
  const flipped = layout === 'flipped';

  // 1. Background
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Visual zone
  if (captionMode !== 'karaoke') {
    if (graphicStyle) {
      const img = getGraphic(graphicStyle);
      if (img) drawGraphic(ctx, img, graphicStyle, style, flipped);
    } else if (waveformStyle !== 'none') {
      drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle, flipped);
    }
  } else if (waveformStyle !== 'none') {
    drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle, flipped);
  }

  // 3. Captions
  const hasVisualZone = captionMode !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
  if (captionMode === 'karaoke') {
    drawKaraokeCaptions(ctx, currentTime, transcript, style, captionGroups, captionAnimation);
  } else {
    drawCaptions(
      ctx,
      currentTime,
      transcript,
      style,
      layout,
      hasVisualZone,
      flipped,
      captionGroups,
      captionAnimation,
      captionTransform
    );
  }

  // 4. Watermark — drawn last so it sits on top
  if (showWatermark) {
    drawWatermark(ctx);
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  variant: WaveformVariant,
  flipped = false
): void {
  if (waveformData.length === 0 || variant === 'none') return;
  const centerY = flipped ? WAVEFORM_CENTER_Y_FLIPPED : undefined;
  const circleCY = flipped ? CIRCLE_CENTER_Y_FLIPPED : undefined;
  switch (variant) {
    case 'circle':
      drawCircleWaveform(ctx, currentTime, duration, waveformData, style, circleCY);
      break;
    case 'spectrogram':
      drawSpectrogram(ctx, currentTime, duration, waveformData, style, centerY);
      break;
    case 'bars':
      drawPillBars(ctx, currentTime, duration, waveformData, style, centerY);
      break;
  }
}
