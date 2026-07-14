import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, CaptionMode, CaptionAnimation, GraphicStyleId, CanvasLayout, CaptionTransform } from '@/stores';
import type { CaptionGroup } from '@/stores/types';
import { drawPillBars, drawCircleWaveform, drawSpectrogram } from '@/lib/waveforms';
import { WAVEFORM_CENTER_Y_FLIPPED, CIRCLE_CENTER_Y_FLIPPED } from '@/lib/waveforms/constants';
import { getGraphic } from '../loaders/graphicLoader';
import { drawGraphic } from '../graphic';
import { drawCaptions, drawSpotlightCaptions, drawStackCaptions } from '../processing/captions';
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
  /**
   * Decoded video background frame for this output frame (VideoFrame or
   * HTMLVideoElement). Caller owns decode/looping/lifecycle; renderFrame
   * only composites. Cover-fit + a fixed dark scrim keeps captions legible
   * over real-life footage.
   */
  backgroundFrame?: CanvasImageSource & { width?: number; height?: number };
}

/** Scrim over video backgrounds so captions stay legible on busy footage. */
export const BACKGROUND_SCRIM_ALPHA = 0.35;

/** Cover-fit source dimensions onto a target canvas. Pure — unit-testable. */
export function coverFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}

function sourceDimensions(
  frame: CanvasImageSource & { width?: number; height?: number }
): { w: number; h: number } {
  if (typeof VideoFrame !== 'undefined' && frame instanceof VideoFrame) {
    return { w: frame.displayWidth, h: frame.displayHeight };
  }
  if (frame instanceof HTMLVideoElement) {
    return { w: frame.videoWidth, h: frame.videoHeight };
  }
  return { w: Number(frame.width) || 0, h: Number(frame.height) || 0 };
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

  // 1. Background — video frame (cover-fit + scrim) or solid color
  const { backgroundFrame } = options;
  if (backgroundFrame) {
    const { w: srcW, h: srcH } = sourceDimensions(backgroundFrame);
    if (srcW > 0 && srcH > 0) {
      const { dx, dy, dw, dh } = coverFit(srcW, srcH, width, height);
      ctx.drawImage(backgroundFrame, dx, dy, dw, dh);
      ctx.fillStyle = `rgba(0, 0, 0, ${BACKGROUND_SCRIM_ALPHA})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Visual zone
  if (captionMode !== 'karaoke') {
    if (graphicStyle) {
      const img = getGraphic(graphicStyle);
      if (img) drawGraphic(ctx, img, graphicStyle, style, flipped);
    } else if (waveformStyle !== 'none') {
      drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle, flipped);
    }
  }

  // 3. Captions
  const hasVisualZone = captionMode !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
  switch (captionMode) {
    case 'karaoke':
      // Karaoke canvas timing is word-scoped; ignore style-panel motion preset here.
      drawKaraokeCaptions(
        ctx,
        currentTime,
        transcript,
        style,
        captionGroups,
        'sweep-pulse',
        captionTransform
      );
      break;
    case 'stack':
      drawStackCaptions(ctx, currentTime, transcript, style, captionGroups, captionTransform);
      break;
    case 'spotlight':
      drawSpotlightCaptions(
        ctx,
        currentTime,
        transcript,
        style,
        layout,
        hasVisualZone,
        captionGroups,
        captionTransform
      );
      break;
    case 'phrase':
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
      break;
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
