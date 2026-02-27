import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import { FPS } from '@Ordio/shared/time';
import type { WaveformVariant, CaptionVariant } from '@/lib/store';

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
}

/**
 * Renders a single video frame to a canvas context.
 * Matches the Naval podcast audiogram style:
 *   - Black background
 *   - Centered caption text (current phrase only, ~5-7 words)
 *   - Full-width dense mirrored waveform bars at ~72% down
 *
 * Pure function — no React, no side effects.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  frameIndex: number,
  totalFrames: number,
  options: FrameOptions
): void {
  const { waveformData, transcript, style, waveformStyle, captionStyle } = options;
  const { width, height } = style;
  const currentTime = frameIndex / FPS;
  const duration = totalFrames / FPS;

  // 1. Background
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Waveform — dense mirrored bars, full width, at ~72% down
  drawWaveform(ctx, currentTime, duration, waveformData, style, waveformStyle);

  // 3. Captions — current phrase centered above waveform
  drawCaptions(ctx, currentTime, transcript, style, captionStyle);
}

// ── Waveform Drawing ────────────────────────────────────────────────

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  variant: WaveformVariant
): void {
  if (waveformData.length === 0) return;
  switch (variant) {
    case 'circle':
      drawCircleWaveform(ctx, currentTime, duration, waveformData, style);
      break;
    case 'spectrogram':
      drawSpectrogram(ctx, currentTime, duration, waveformData, style);
      break;
    case 'bars':
    default:
      drawPillBars(ctx, currentTime, duration, waveformData, style);
      break;
  }
}

// ── Layout constants ────────────────────────────────────────────────

const WAVEFORM_CENTER_Y = 0.72;
const WAVEFORM_MAX_AMP = 0.07;
const WAVEFORM_WIDTH_RATIO = 0.82;
const BAR_COUNT = 48;
const BAR_GAP = 5;
const BAR_MIN_WIDTH = 6;
const SPOKE_COUNT = 120;
const SPOKE_WIDTH = 3;
const CIRCLE_CENTER_Y = 0.62;
const CIRCLE_INNER_RADIUS = 0.08;
const CIRCLE_MAX_BAR_LEN = 0.12;
const MIN_AMPLITUDE = 0.04;
const MIN_BAR_HEIGHT = 4;

// ── Shared helpers ──────────────────────────────────────────────────

function getCurrentAmplitude(
  currentTime: number,
  duration: number,
  waveformData: number[]
): number {
  if (waveformData.length === 0 || duration <= 0) return 0;
  const progress = currentTime / duration;
  const sampleIndex = Math.min(
    Math.floor(progress * waveformData.length),
    waveformData.length - 1
  );
  return waveformData[Math.max(0, sampleIndex)];
}

function barAmplitude(
  baseAmp: number,
  currentTime: number,
  barIndex: number,
  barCount: number
): number {
  const center = (barCount - 1) / 2;
  const distFromCenter = Math.abs(barIndex - center) / center;
  const bellCurve = 1.0 - distFromCenter * 0.5;

  const wave1 = Math.sin(currentTime * 4.0 + barIndex * 0.25) * 0.15;
  const wave2 = Math.sin(currentTime * 2.3 + barIndex * 0.4) * 0.1;
  const wave3 = Math.sin(currentTime * 6.0 + barIndex * 0.12) * 0.05;

  return Math.max(MIN_AMPLITUDE, baseAmp * bellCurve + wave1 + wave2 + wave3);
}

interface BarLayout {
  barWidth: number;
  startX: number;
}

function computeBarLayout(canvasWidth: number): BarLayout {
  const totalGaps = (BAR_COUNT - 1) * BAR_GAP;
  const barWidth = Math.max(BAR_MIN_WIDTH, (canvasWidth * WAVEFORM_WIDTH_RATIO - totalGaps) / BAR_COUNT);
  const startX = (canvasWidth - (BAR_COUNT * barWidth + totalGaps)) / 2;
  return { barWidth, startX };
}

function drawPillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// ── Bars: Audio-reactive mirrored pill bars ─────────────────────────

function drawPillBars(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
): void {
  const { width, height, waveColor } = style;
  const centerY = height * WAVEFORM_CENTER_Y;
  const maxAmp = height * WAVEFORM_MAX_AMP;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);
  const { barWidth, startX } = computeBarLayout(width);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = waveColor;

  for (let i = 0; i < BAR_COUNT; i++) {
    const amp = barAmplitude(baseAmp, currentTime, i, BAR_COUNT);
    const barH = Math.max(MIN_BAR_HEIGHT, amp * maxAmp);
    const x = startX + i * (barWidth + BAR_GAP);

    drawPillRect(ctx, x, centerY - barH, barWidth, barH * 2, barWidth / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// ── Circle: Audio-reactive radial waveform ──────────────────────────

function drawCircleWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
): void {
  const { width, height, waveColor } = style;
  const cx = width / 2;
  const cy = height * CIRCLE_CENTER_Y;
  const smallerDim = Math.min(width, height);
  const innerRadius = smallerDim * CIRCLE_INNER_RADIUS;
  const maxBarLen = smallerDim * CIRCLE_MAX_BAR_LEN;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);

  ctx.strokeStyle = waveColor;
  ctx.lineWidth = SPOKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;

  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const wave1 = Math.sin(currentTime * 3.5 + i * 0.18) * 0.15;
    const wave2 = Math.sin(currentTime * 2.0 + i * 0.35) * 0.1;
    const amp = Math.max(MIN_AMPLITUDE, baseAmp + wave1 + wave2);
    const barLen = Math.max(3, amp * maxBarLen);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
    ctx.lineTo(cx + Math.cos(angle) * (innerRadius + barLen), cy + Math.sin(angle) * (innerRadius + barLen));
    ctx.stroke();
  }

  drawInnerCircle(ctx, cx, cy, innerRadius, waveColor);
}

function drawInnerCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.08;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.15;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

// ── Spectrogram: Audio-reactive color-gradient bands ─────────────────

const SPECTROGRAM_COLORS: [number, number, number][] = [
  [59, 130, 246],   // blue
  [45, 212, 191],   // cyan
  [34, 197, 94],    // green
  [234, 179, 8],    // yellow
  [249, 115, 22],   // orange
  [236, 72, 153],   // magenta
  [168, 85, 247],   // purple
];

function interpolateColor(t: number): string {
  const idx = t * (SPECTROGRAM_COLORS.length - 1);
  const low = Math.floor(idx);
  const high = Math.min(low + 1, SPECTROGRAM_COLORS.length - 1);
  const frac = idx - low;
  const r = Math.round(SPECTROGRAM_COLORS[low][0] + (SPECTROGRAM_COLORS[high][0] - SPECTROGRAM_COLORS[low][0]) * frac);
  const g = Math.round(SPECTROGRAM_COLORS[low][1] + (SPECTROGRAM_COLORS[high][1] - SPECTROGRAM_COLORS[low][1]) * frac);
  const b = Math.round(SPECTROGRAM_COLORS[low][2] + (SPECTROGRAM_COLORS[high][2] - SPECTROGRAM_COLORS[low][2]) * frac);
  return `rgb(${r},${g},${b})`;
}

const GLOW_THRESHOLD = 0.35;

function drawSpectrogram(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
): void {
  const { width, height } = style;
  const centerY = height * WAVEFORM_CENTER_Y;
  const maxAmp = height * WAVEFORM_MAX_AMP;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);
  const { barWidth, startX } = computeBarLayout(width);
  const radius = barWidth / 2;

  for (let i = 0; i < BAR_COUNT; i++) {
    const amp = barAmplitude(baseAmp, currentTime, i, BAR_COUNT);
    const barH = Math.max(MIN_BAR_HEIGHT, amp * maxAmp);
    const x = startX + i * (barWidth + BAR_GAP);
    const y = centerY - barH;
    const fullH = barH * 2;

    const color = interpolateColor(i / (BAR_COUNT - 1));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    drawPillRect(ctx, x, y, barWidth, fullH, radius);
    ctx.fill();

    if (amp > GLOW_THRESHOLD) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      drawPillRect(ctx, x, y, barWidth, fullH, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1.0;
}

// ── Caption Drawing ─────────────────────────────────────────────────

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  captionStyle: CaptionVariant
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize } = style;
  const padding = width * 0.08;
  const maxWidth = width - padding * 2;

  // Get the current phrase (not a rolling window — discrete phrases)
  const phrase = getCurrentPhrase(transcript, currentTime);
  if (!phrase || phrase.length === 0) return;

  const text = phrase.map((w) => w.text).join(' ');

  // Font setup — semi-bold for readability
  const fontWeight = '600';
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;

  // Measure and wrap text
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;

  // Waveform sits at 72% down — place captions well above it with clear gap
  // The gap scales with height so it works for both 1:1 and 9:16
  const waveformTop = height * 0.72 - height * 0.07; // top of tallest bar
  const gapAboveWaveform = height * 0.06;
  const captionBottom = waveformTop - gapAboveWaveform;

  const textY =
    captionStyle === 'bottom'
      ? captionBottom - totalHeight
      : (captionBottom - totalHeight) / 2;

  // Draw centered text
  ctx.textAlign = 'center';
  const centerX = width / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, textY + i * lineHeight + lineHeight / 2);
  }
}

// ── Utilities ───────────────────────────────────────────────────────

/**
 * Get the current phrase — a group of ~5-7 words that are currently being spoken.
 * Instead of a sliding window, this groups words into natural phrase chunks
 * and shows only the current chunk (like the Naval podcast style).
 */
function getCurrentPhrase(transcript: Word[], currentTime: number): Word[] {
  if (transcript.length === 0) return [];

  const WORDS_PER_PHRASE = 6;

  // Group transcript into fixed-size phrases
  const phraseIndex = findCurrentPhraseIndex(transcript, currentTime, WORDS_PER_PHRASE);
  if (phraseIndex < 0) return [];

  const start = phraseIndex * WORDS_PER_PHRASE;
  const end = Math.min(start + WORDS_PER_PHRASE, transcript.length);

  return transcript.slice(start, end);
}

/**
 * Find which phrase group the current time falls into.
 */
function findCurrentPhraseIndex(
  transcript: Word[],
  currentTime: number,
  wordsPerPhrase: number
): number {
  // Find the word being spoken at currentTime
  let wordIdx = -1;
  for (let i = 0; i < transcript.length; i++) {
    if (currentTime >= transcript[i].start && currentTime < transcript[i].end) {
      wordIdx = i;
      break;
    }
    // If between words, use the most recent word
    if (currentTime >= transcript[i].end && (i === transcript.length - 1 || currentTime < transcript[i + 1].start)) {
      wordIdx = i;
      break;
    }
  }

  // Before first word
  if (wordIdx < 0 && transcript.length > 0 && currentTime < transcript[0].start) {
    return 0;
  }

  if (wordIdx < 0) return -1;

  return Math.floor(wordIdx / wordsPerPhrase);
}

/**
 * Simple word-wrap for canvas text.
 */
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
