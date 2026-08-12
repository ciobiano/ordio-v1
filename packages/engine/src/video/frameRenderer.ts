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
import { drawGradientBackground } from '../backgrounds/gradientBackground';
import { restyleTranscript, restyleCaptionGroups } from '../processing/captions/textCase';
import { measureCaptionBlockRect } from '../processing/captions/blockRect';

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
/** Bottom-anchored scrim, from the design study: 44% of frame height, 0.55 -> transparent. */
export const BOTTOM_SCRIM_HEIGHT_RATIO = 0.44;
export const BOTTOM_SCRIM_ALPHA = 0.55;

/** Darkens a photo/video background so captions stay readable over it. */
function drawBackgroundScrim(
  ctx: CanvasRenderingContext2D,
  mode: NonNullable<StyleConfig['backgroundScrim']>,
  width: number,
  height: number
): void {
  if (mode === 'none') return;

  if (mode === 'bottom') {
    const top = height * (1 - BOTTOM_SCRIM_HEIGHT_RATIO);
    const gradient = ctx.createLinearGradient(0, height, 0, top);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${BOTTOM_SCRIM_ALPHA})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, width, height - top);
    return;
  }

  ctx.fillStyle = `rgba(0, 0, 0, ${BACKGROUND_SCRIM_ALPHA})`;
  ctx.fillRect(0, 0, width, height);
}

export interface FitRect { dx: number; dy: number; dw: number; dh: number }

/** Cover-fit source dimensions onto a target canvas. Pure — unit-testable. */
export function coverFit(srcW: number, srcH: number, dstW: number, dstH: number): FitRect {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}

/** Contain-fit — the whole source stays visible, letterboxed. Pure. */
export function containFit(srcW: number, srcH: number, dstW: number, dstH: number): FitRect {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}

/**
 * How far the source and target aspect ratios may diverge before 'auto' stops
 * cropping. A 16:9 clip in a 1:1 frame is 1.78 — well past this, so it gets
 * letterboxed rather than losing a third of its width. A 4:5 in a 1:1 is 1.25,
 * close enough that cropping reads as framing rather than as loss.
 */
const AUTO_COVER_MAX_DIVERGENCE = 1.35;

/**
 * Resolve the draw rect for a backdrop under the chosen content fit.
 *
 * 'auto' is the interesting one: it covers when the shapes are close and
 * contains when they are not, so a portrait clip dropped into a square canvas
 * keeps its whole frame instead of being centre-punched.
 */
export function resolveContentFit(
  mode: NonNullable<StyleConfig['contentFit']>,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): FitRect {
  if (mode === 'fill') return coverFit(srcW, srcH, dstW, dstH);
  if (mode === 'fit') return containFit(srcW, srcH, dstW, dstH);

  const sourceRatio = srcW / srcH;
  const targetRatio = dstW / dstH;
  const divergence = Math.max(sourceRatio / targetRatio, targetRatio / sourceRatio);
  return divergence <= AUTO_COVER_MAX_DIVERGENCE
    ? coverFit(srcW, srcH, dstW, dstH)
    : containFit(srcW, srcH, dstW, dstH);
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


/** Panel padding and corner, as ratios of font size so the backdrop tracks the
 *  caption rather than staying a fixed slab as the type scales. */
const CAPTION_BACKDROP_PAD_X_RATIO = 0.55;
const CAPTION_BACKDROP_PAD_Y_RATIO = 0.3;
const CAPTION_BACKDROP_RADIUS_RATIO = 0.22;

/**
 * Filled panel behind the whole caption block.
 *
 * Drawn from the same rect the preview's drag frame uses, so what you position
 * is what gets painted. Rotated about the block centre rather than the canvas
 * origin — a rotated caption keeps its panel square to the words.
 */
function drawCaptionBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { centerX: number; centerY: number; width: number; height: number; rotationDeg: number },
  color: string,
  fontSize: number
): void {
  const padX = fontSize * CAPTION_BACKDROP_PAD_X_RATIO;
  const padY = fontSize * CAPTION_BACKDROP_PAD_Y_RATIO;
  const radius = fontSize * CAPTION_BACKDROP_RADIUS_RATIO;
  const w = rect.width + padX * 2;
  const h = rect.height + padY * 2;

  ctx.save();
  ctx.translate(rect.centerX, rect.centerY);
  ctx.rotate((rect.rotationDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.fill();
  } else {
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
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
        const fit = resolveContentFit(style.contentFit ?? 'fill', srcW, srcH, width, height);
        // Letterbox bars show the canvas colour rather than whatever the last
        // frame left behind.
        if (fit.dw < width || fit.dh < height) {
          ctx.fillStyle = style.backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(backgroundFrame, fit.dx, fit.dy, fit.dw, fit.dh);
      }
      drawBackgroundScrim(ctx, style.backgroundScrim ?? 'flat', width, height);
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
  //
  // Casing is applied here rather than inside each mechanic: all four take the
  // same two inputs, and doing it before layout means measurement sees the text
  // that actually paints (uppercase is wider, and would otherwise wrap
  // differently from how it renders).
  const textOptions = {
    transform: style.textTransform ?? 'none',
    hidePunctuation: style.hidePunctuation ?? false,
  };
  const casedTranscript = restyleTranscript(transcript, textOptions);
  const casedGroups = captionGroups && restyleCaptionGroups(captionGroups, textOptions);

  const hasVisualZone = !takesFullScreen && (waveformStyle !== 'none' || !!graphicStyle);

  // Backdrop first, so the words sit on it. Measuring costs a layout pass, so
  // it only runs when there is actually a panel to draw.
  if (style.captionBackgroundEnabled && style.captionBackgroundColor) {
    const rect = measureCaptionBlockRect({
      ctx,
      currentTime,
      transcript: casedTranscript,
      captionGroups: casedGroups,
      style,
      layout,
      hasVisualZone,
      flipped,
      transform: captionTransform,
    });
    if (rect) {
      drawCaptionBackdrop(ctx, rect, style.captionBackgroundColor, style.fontSize);
    }
  }

  switch (mechanic) {
    case 'static-highlight':
      drawStaticHighlightCaptions(ctx, currentTime, casedTranscript, style, captionTransform, casedGroups);
      break;
    case 'word-swap':
      drawWordSwapCaptions(
        ctx,
        currentTime,
        casedTranscript,
        style,
        layout,
        hasVisualZone,
        flipped,
        casedGroups,
        captionTransform
      );
      break;
    case 'phrase-cut':
      drawPhraseCutCaptions(
        ctx,
        currentTime,
        casedTranscript,
        style,
        layout,
        hasVisualZone,
        flipped,
        casedGroups,
        captionTransform
      );
      break;
    case 'progressive-reveal':
      drawProgressiveRevealCaptions(
        ctx,
        currentTime,
        casedTranscript,
        style,
        layout,
        hasVisualZone,
        flipped,
        casedGroups,
        captionTransform
      );
      break;
  }

  // 4. Watermark — drawn last so it sits on top of everything else.
  if (showWatermark) {
    drawWatermark(ctx, currentTime, style);
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
