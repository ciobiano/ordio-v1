import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, CaptionVariant, GraphicStyleId } from '@/lib/store';
import { drawPillBars, drawCircleWaveform, drawSpectrogram } from '@/lib/waveforms';
import { getGraphic } from '@/lib/graphicLoader';

export interface FrameOptions {
  /** Pre-computed waveform samples (0-1 normalized), typically 200+ values */
  waveformData: number[];
  /** Word-level transcript with timestamps */
  transcript: Word[];
  /** Visual style configuration */
  style: StyleConfig;
  /** Waveform rendering variant */
  waveformStyle: WaveformVariant;
  /** Caption rendering variant */
  captionStyle: CaptionVariant;
  /** Show "Made with Ordio" watermark — true for free tier */
  showWatermark?: boolean;
  /** null = use waveform; non-null = render this SVG graphic instead */
  graphicStyle?: GraphicStyleId;
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
  const { waveformData, transcript, style, waveformStyle, captionStyle, showWatermark, graphicStyle } = options;
  const { width, height } = style;
  const currentTime = frameIndex / FPS;
  const duration = totalFrames / FPS;

  // 1. Background
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Visual zone — graphic or waveform
  const shouldDrawWaveform = captionStyle !== 'karaoke' && waveformStyle !== 'none' && !graphicStyle;

  if (graphicStyle) {
    const img = getGraphic(graphicStyle);
    if (img) drawGraphic(ctx, img, graphicStyle, style);
  } else if (shouldDrawWaveform) {
    drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle);
  }

  // 3. Captions — hasVisualZone keeps captions above graphic same as above waveform
  const hasVisualZone = captionStyle !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
  if (captionStyle === 'karaoke') {
    drawKaraokeCaptions(ctx, currentTime, transcript, style);
  } else {
    drawCaptions(ctx, currentTime, transcript, style, captionStyle, hasVisualZone);
  }

  // 4. Watermark — drawn last so it appears on top
  if (showWatermark) {
    drawWatermark(ctx);
  }
}

// ── Graphic Drawing ──────────────────────────────────────────────────

function drawGraphic(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  graphicStyle: NonNullable<GraphicStyleId>,
  style: StyleConfig
): void {
  const { width, height } = style;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Fit within 70% width and 30% height, preserving aspect ratio
  const maxW = width * 0.7;
  const maxH = height * 0.3;
  const fitByWidth = maxW / aspectRatio <= maxH;
  const drawW = fitByWidth ? maxW : maxH * aspectRatio;
  const drawH = fitByWidth ? maxW / aspectRatio : maxH;

  // Centre horizontally; vertically centred on the waveform zone
  const drawX = (width - drawW) / 2;
  const drawY = height * WAVEFORM_CENTER_Y - drawH / 2;

  if (graphicStyle === 'graphic-frame1') {
    // Tint with creator's accent colour (waveColor) via OffscreenCanvas
    const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = style.waveColor;
    octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);
  } else {
    // graphic-frame2: draw as-is (white fill in SVG)
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}

// ── Waveform Dispatch ───────────────────────────────────────────────

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  variant: WaveformVariant
): void {
  if (waveformData.length === 0 || variant === 'none') return;
  switch (variant) {
    case 'circle':
      drawCircleWaveform(ctx, currentTime, duration, waveformData, style);
      break;
    case 'spectrogram':
      drawSpectrogram(ctx, currentTime, duration, waveformData, style);
      break;
    case 'bars':
      drawPillBars(ctx, currentTime, duration, waveformData, style);
      break;
  }
}

// ── Caption Drawing ─────────────────────────────────────────────────

const WAVEFORM_CENTER_Y = 0.72;
const WAVEFORM_MAX_AMP = 0.07;
const GAP_ABOVE_WAVEFORM = 0.06;
const CAPTION_PADDING = 0.08;
const FONT_WEIGHT = '600';
const WORDS_PER_PHRASE = 6;

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  captionStyle: CaptionVariant,
  hasVisualZone: boolean
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize } = style;
  const padding = width * CAPTION_PADDING;
  const maxWidth = width - padding * 2;

  const phrase = getCurrentPhrase(transcript, currentTime);
  if (!phrase || phrase.length === 0) return;

  const text = phrase.map((w) => w.text).join(' ');

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;

  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;

  let textY: number;
  if (!hasVisualZone) {
    textY = (height - totalHeight) / 2;
  } else {
    const waveformTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
    const captionBottom = waveformTop - height * GAP_ABOVE_WAVEFORM;

    textY =
      captionStyle === 'bottom'
        ? captionBottom - totalHeight
        : (captionBottom - totalHeight) / 2;
  }

  ctx.textAlign = 'center';
  const centerX = width / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, textY + i * lineHeight + lineHeight / 2);
  }
}

// ── Karaoke Caption Drawing ──────────────────────────────────────────

function drawKaraokeCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize } = style;
  const padding = width * CAPTION_PADDING;
  const maxWidth = width - padding * 2;

  const phrase = getCurrentPhrase(transcript, currentTime);
  if (!phrase || phrase.length === 0) return;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = textColor;

  const spaceWidth = ctx.measureText(' ').width;

  // Typewriter reveal: only show words whose start time has passed
  const visible = phrase
    .filter((w) => w.start <= currentTime)
    .map((w) => ({
      text: w.text,
      width: ctx.measureText(w.text).width,
      isActive: currentTime < w.end,
    }));

  const totalWidth =
    visible.reduce((sum, w) => sum + w.width, 0) +
    spaceWidth * Math.max(0, visible.length - 1);

  // Clamp to maxWidth
  let x = Math.max(padding, (width - Math.min(totalWidth, maxWidth)) / 2);
  const y = height / 2;

  for (const w of visible) {
    ctx.globalAlpha = w.isActive ? 1.0 : 0.4;
    ctx.fillText(w.text, x, y);
    x += w.width + spaceWidth;
  }

  ctx.globalAlpha = 1.0;
}

// ── Watermark ────────────────────────────────────────────────────────

function drawWatermark(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '400 14px "Geist", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('Ordio by Kaine Studio', 16, 16);
  ctx.restore();
}

// ── Utilities ───────────────────────────────────────────────────────

function getCurrentPhrase(transcript: Word[], currentTime: number): Word[] {
  if (transcript.length === 0) return [];

  const phraseIndex = findCurrentPhraseIndex(transcript, currentTime, WORDS_PER_PHRASE);
  if (phraseIndex < 0) return [];

  const start = phraseIndex * WORDS_PER_PHRASE;
  const end = Math.min(start + WORDS_PER_PHRASE, transcript.length);

  return transcript.slice(start, end);
}

function findCurrentPhraseIndex(
  transcript: Word[],
  currentTime: number,
  wordsPerPhrase: number
): number {
  let wordIdx = -1;
  for (let i = 0; i < transcript.length; i++) {
    if (currentTime >= transcript[i].start && currentTime < transcript[i].end) {
      wordIdx = i;
      break;
    }
    if (currentTime >= transcript[i].end && (i === transcript.length - 1 || currentTime < transcript[i + 1].start)) {
      wordIdx = i;
      break;
    }
  }

  if (wordIdx < 0 && transcript.length > 0 && currentTime < transcript[0].start) {
    return 0;
  }

  if (wordIdx < 0) return -1;

  return Math.floor(wordIdx / wordsPerPhrase);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);

  return lines;
}
