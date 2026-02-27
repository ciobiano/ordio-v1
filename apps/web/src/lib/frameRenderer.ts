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
  _variant: WaveformVariant
): void {
  if (waveformData.length === 0) return;
  drawFlowingWave(ctx, currentTime, duration, waveformData, style);
}

/**
 * Smooth flowing waveform — a filled, organic shape that mirrors
 * vertically around a center line. No bars, no dots, no strokes.
 * Uses cubic bezier curves through the waveform samples for a
 * fluid, continuous look. The wave gently animates with time.
 */
function drawFlowingWave(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
): void {
  const { width, height, waveColor } = style;
  const centerY = height * 0.72;
  const maxAmplitude = height * 0.035;

  const progress = duration > 0 ? currentTime / duration : 0;

  // Sample points across the width — smooth, not dense
  const pointCount = 120;
  const points: Array<{ x: number; amp: number }> = [];

  for (let i = 0; i <= pointCount; i++) {
    const t = i / pointCount;
    const x = t * width;

    // Map to waveform data
    const sampleIndex = Math.min(
      Math.floor(t * waveformData.length),
      waveformData.length - 1
    );
    const rawAmp = waveformData[sampleIndex];

    // Dampen future (unplayed) portion
    let dampening: number;
    if (t <= progress) {
      dampening = 1.0;
    } else {
      // Gentle fade from playhead forward
      const dist = t - progress;
      dampening = Math.max(0.15, 1.0 - dist * 3);
    }

    // Add subtle organic motion based on time
    const timeWobble = Math.sin(currentTime * 2.5 + i * 0.15) * 0.08;
    const amp = Math.max(0.01, (rawAmp + timeWobble) * dampening);

    points.push({ x, amp });
  }

  // Draw filled shape — top half
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  for (let i = 0; i < points.length; i++) {
    const { x, amp } = points[i];
    const y = centerY - amp * maxAmplitude;

    if (i === 0) {
      ctx.lineTo(x, y);
    } else {
      // Smooth cubic bezier between points
      const prev = points[i - 1];
      const cpx = (prev.x + x) / 2;
      ctx.bezierCurveTo(cpx, centerY - prev.amp * maxAmplitude, cpx, y, x, y);
    }
  }

  // Close top half back to center
  ctx.lineTo(width, centerY);

  // Mirror: bottom half (draw right to left)
  for (let i = points.length - 1; i >= 0; i--) {
    const { x, amp } = points[i];
    const y = centerY + amp * maxAmplitude;

    if (i === points.length - 1) {
      ctx.lineTo(x, y);
    } else {
      const next = points[i + 1];
      const cpx = (next.x + x) / 2;
      ctx.bezierCurveTo(cpx, centerY + next.amp * maxAmplitude, cpx, y, x, y);
    }
  }

  ctx.closePath();

  // Fill with solid color
  ctx.fillStyle = waveColor;
  ctx.fill();

  // Playhead indicator — thin vertical line at current position
  if (progress > 0 && progress < 1) {
    const playheadX = progress * width;
    ctx.beginPath();
    ctx.moveTo(playheadX, centerY - maxAmplitude * 1.5);
    ctx.lineTo(playheadX, centerY + maxAmplitude * 1.5);
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }
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

  // Font setup — clean, light weight
  const fontWeight = '300';
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;

  // Measure and wrap text
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.35;
  const totalHeight = lines.length * lineHeight;

  // Position: centered vertically above waveform (~50-55% down)
  let textY: number;
  switch (captionStyle) {
    case 'center':
      textY = height * 0.52 - totalHeight / 2;
      break;
    case 'bottom':
      textY = height * 0.52 - totalHeight / 2;
      break;
    case 'karaoke':
      textY = height * 0.52 - totalHeight / 2;
      break;
  }

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
