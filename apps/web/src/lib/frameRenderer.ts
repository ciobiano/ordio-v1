import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, CaptionVariant } from '@/lib/store';
import { drawPillBars, drawCircleWaveform, drawSpectrogram } from '@/lib/waveforms';

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
  const { waveformData, transcript, style, waveformStyle, captionStyle, showWatermark } = options;
  const { width, height } = style;
  const currentTime = frameIndex / FPS;
  const duration = totalFrames / FPS;

  // 1. Background
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Waveform — skip for karaoke (text-only) and 'none' variant
  const showWaveform = captionStyle !== 'karaoke' && waveformStyle !== 'none';
  if (showWaveform) {
    drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle);
  }

  // 3. Captions
  if (captionStyle === 'karaoke') {
    drawKaraokeCaptions(ctx, currentTime, transcript, style);
  } else {
    drawCaptions(ctx, currentTime, transcript, style, captionStyle, showWaveform);
  }

  // 4. Watermark — drawn last so it appears on top
  if (showWatermark) {
    drawWatermark(ctx, width, height);
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
  showWaveform: boolean
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
  if (!showWaveform) {
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

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const text = 'Made with Ordio';
  const offsetX = 24;
  const offsetY = 24;

  ctx.save();
  ctx.font = `500 13px "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  const textWidth = ctx.measureText(text).width;
  const x = width - offsetX;
  const y = height - offsetY;

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - textWidth / 2, y, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);

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
