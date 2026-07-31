import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, GraphicStyleId, CanvasLayout, CaptionTransform, CaptionGroup } from '../types';
import { drawPillBars, drawCircleWaveform, drawSpectrogram, drawOrbWaveform, drawBaselineWaveform } from '../waveforms';
import { WAVEFORM_CENTER_Y_FLIPPED, CIRCLE_CENTER_Y_FLIPPED, ORB_CENTER_Y_FLIPPED } from '../waveforms/constants';
import { getGraphic } from '../loaders/graphicLoader';
import { drawGraphic } from '../graphic';
import {
  drawWordSwapCaptions,
  drawPhraseCutCaptions,
  drawStaticHighlightCaptions,
  drawProgressiveRevealCaptions,
} from '../processing/captions';
import { getCaptionStylePreset } from '../captions/presets';
import { drawWatermark } from '../processing/watermark';
import { drawLookChrome } from './lookChrome';
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

/**
 * Canvas-preset artwork idles with the design system's `ord-shape-drift`
 * motion — a 9s loop rotating ±4deg and scaling ±3% (see tokens/motion.css
 * in the Ordio Canvas Presets design system: `ease-ripple`, `dur 9s`).
 * A sine wave approximates that cubic-bezier closely enough at this
 * subtlety, and — unlike a CSS animation — is a pure function of
 * currentTime, so preview and export land on the identical frame.
 */
const PRESET_DRIFT_PERIOD_SEC = 9;
const PRESET_DRIFT_MAX_ROTATE_DEG = 4;
const PRESET_DRIFT_MAX_SCALE = 0.03;
/** Overscan so the drifted (rotated) art never reveals a canvas-color corner. */
const PRESET_DRIFT_OVERSCAN = 1.12;

function presetDriftTransform(currentTime: number): { rotate: number; scale: number } {
  const phase = ((currentTime % PRESET_DRIFT_PERIOD_SEC) / PRESET_DRIFT_PERIOD_SEC) * Math.PI * 2;
  const wave = Math.sin(phase);
  return {
    rotate: (PRESET_DRIFT_MAX_ROTATE_DEG * wave * Math.PI) / 180,
    scale: 1 + PRESET_DRIFT_MAX_SCALE * wave,
  };
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
  const captionPreset = getCaptionStylePreset(style.captionStyleId);
  const mechanic = captionPreset.mechanic;

  // 1. Background — video frame (cover-fit + scrim), gradient, or solid color
  const { backgroundFrame } = options;
  if (backgroundFrame) {
    const { w: srcW, h: srcH } = sourceDimensions(backgroundFrame);
    if (srcW > 0 && srcH > 0) {
      const isPreset = style.background?.type === 'image' && style.background.source === 'preset';
      if (isPreset) {
        const { dx, dy, dw, dh } = coverFit(srcW, srcH, width * PRESET_DRIFT_OVERSCAN, height * PRESET_DRIFT_OVERSCAN);
        const { rotate, scale } = presetDriftTransform(currentTime);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(rotate);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(backgroundFrame, dx - (width * (PRESET_DRIFT_OVERSCAN - 1)) / 2, dy - (height * (PRESET_DRIFT_OVERSCAN - 1)) / 2, dw, dh);
        ctx.restore();
      } else {
        const { dx, dy, dw, dh } = coverFit(srcW, srcH, width, height);
        ctx.drawImage(backgroundFrame, dx, dy, dw, dh);
      }
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

  // 2. Visual zone — styles that own the stage (karaoke lyrics) suppress the
  // waveform/graphic entirely; every other style shares the frame with it.
  const takesFullScreen = captionPreset.ownsStage;
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
    case 'progressive-reveal':
      drawProgressiveRevealCaptions(
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

  // 4. Look chrome — the fixed marks a look's own composition includes.
  drawLookChrome(ctx, currentTime, style, waveformStyle);

  // 5. Watermark — drawn last so it sits on top
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
  if (variant === 'none') return;
  // The orb runs on its own clock rather than the audio, so it still draws
  // when there are no samples — every amplitude-driven variant bails.
  if (variant === 'orb') {
    drawOrbWaveform(ctx, currentTime, style, flipped ? ORB_CENTER_Y_FLIPPED : undefined);
    return;
  }
  if (waveformData.length === 0) return;

  const centerY = flipped ? WAVEFORM_CENTER_Y_FLIPPED : undefined;
  const circleCY = flipped ? CIRCLE_CENTER_Y_FLIPPED : undefined;
  switch (variant) {
    case 'circle':
      drawCircleWaveform(ctx, currentTime, duration, waveformData, style, circleCY);
      break;
    case 'spectrogram':
      drawSpectrogram(ctx, currentTime, duration, waveformData, style, centerY);
      break;
    case 'baseline':
      drawBaselineWaveform(ctx, currentTime, duration, waveformData, style, flipped);
      break;
    case 'bars':
      drawPillBars(ctx, currentTime, duration, waveformData, style, centerY);
      break;
  }
}
