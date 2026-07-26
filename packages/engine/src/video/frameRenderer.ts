import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, GraphicStyleId, CanvasLayout, CaptionTransform, CaptionGroup } from '../types';
import { drawPillBars, drawCircleWaveform, drawSpectrogram } from '../waveforms';
import { WAVEFORM_CENTER_Y_FLIPPED, CIRCLE_CENTER_Y_FLIPPED } from '../waveforms/constants';
import { getGraphic } from '../loaders/graphicLoader';
import { drawGraphic } from '../graphic';
import {
  drawWordSwapCaptions,
  drawPhraseCutCaptions,
  drawStaticHighlightCaptions,
} from '../processing/captions';
import { getCaptionStylePreset } from '../captions/presets';
import { drawWatermark } from '../processing/watermark';
import { drawGradientBackground } from '../backgrounds/gradientBackground';

export interface FrameOptions {
  waveformData: number[];
  transcript: Word[];
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  canvasLayout?: CanvasLayout;
  showWatermark?: boolean;
  graphicStyle?: GraphicStyleId;
  /** Editorial caption groups from processingStore. Falls back to auto-phrase grouping if omitted. */
  captionGroups?: CaptionGroup[];
  captionTransform?: CaptionTransform;
  /**
   * Decoded background frame for this output frame — a video frame
   * (VideoFrame or HTMLVideoElement) or a static custom-uploaded image
   * (HTMLImageElement). Caller owns decode/lifecycle; renderFrame only
   * composites. Cover-fit + a fixed dark scrim keeps captions legible over
   * busy footage or photos either way.
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
  const mechanic = getCaptionStylePreset(style.captionStyleId).mechanic;

  // 1. Background — video frame (cover-fit + scrim), gradient, or solid color
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
  } else if (style.background?.type === 'gradient') {
    drawGradientBackground(ctx, style.background.variant, style.background.decoration, width, height);
  } else {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Visual zone — static-highlight's multi-line block takes the same
  // full-screen precedence the old karaoke mode had; other mechanics share
  // the screen with the waveform/graphic zone as phrase mode always did.
  const takesFullScreen = mechanic === 'static-highlight';
  if (!takesFullScreen) {
    if (graphicStyle) {
      const img = getGraphic(graphicStyle);
      if (img) drawGraphic(ctx, img, graphicStyle, style, flipped);
    } else if (waveformStyle !== 'none') {
      drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle, flipped);
    }
  }

  // 3. Captions
  const hasVisualZone = !takesFullScreen && (waveformStyle !== 'none' || !!graphicStyle);
  switch (mechanic) {
    case 'static-highlight':
      drawStaticHighlightCaptions(ctx, currentTime, transcript, style, captionTransform, captionGroups);
      break;
    case 'word-swap':
      drawWordSwapCaptions(
        ctx,
        currentTime,
        transcript,
        style,
        layout,
        hasVisualZone,
        flipped,
        captionGroups,
        captionTransform
      );
      break;
    case 'phrase-cut':
      drawPhraseCutCaptions(
        ctx,
        currentTime,
        transcript,
        style,
        layout,
        hasVisualZone,
        flipped,
        captionGroups,
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
