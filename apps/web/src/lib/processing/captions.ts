import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout } from '@/stores';
import {
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
  GAP_ABOVE_WAVEFORM,
} from '@/lib/waveforms/constants';

const CAPTION_PADDING = 0.08;
const FONT_WEIGHT = '600';
const WORDS_PER_PHRASE = 6;
const MIN_CAPTION_SAFE_ZONE = 0.02;
const PHRASE_FADE_DURATION = 0.15;

let lastPhraseIndex = -1;
let lastPhraseText = '';

function getPhraseTransition(
  transcript: Word[],
  currentTime: number
): { currentText: string; prevText: string; progress: number } {
  const currentIdx = findCurrentPhraseIndex(transcript, currentTime, WORDS_PER_PHRASE);

  if (currentIdx !== lastPhraseIndex && currentIdx >= 0) {
    const start = currentIdx * WORDS_PER_PHRASE;
    const end = Math.min(start + WORDS_PER_PHRASE, transcript.length);
    const newText = transcript
      .slice(start, end)
      .map((w) => w.text)
      .join(' ');
    const prevText = lastPhraseText;

    lastPhraseIndex = currentIdx;
    lastPhraseText = newText;

    return { currentText: newText, prevText, progress: 0 };
  }

  const wordIdx = findCurrentPhraseIndex(transcript, currentTime, WORDS_PER_PHRASE);
  if (wordIdx >= 0) {
    const start = wordIdx * WORDS_PER_PHRASE;
    const end = Math.min(start + WORDS_PER_PHRASE, transcript.length);
    const text = transcript
      .slice(start, end)
      .map((w) => w.text)
      .join(' ');
    lastPhraseText = text;
    return { currentText: text, prevText: '', progress: 1 };
  }

  return { currentText: '', prevText: lastPhraseText, progress: 1 };
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize } = style;
  const padding = width * CAPTION_PADDING;

  const transition = getPhraseTransition(transcript, currentTime);
  if (!transition.currentText && !transition.prevText) return;

  const text = transition.currentText || transition.prevText;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const lines = [text];
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;
  const safePad = height * CAPTION_PADDING;

  let textY: number;
  if (!hasVisualZone) {
    textY = (height - totalHeight) / 2;
  } else if (!flipped) {
    const waveformTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
    const minSafeZone = height * MIN_CAPTION_SAFE_ZONE;
    const captionBottom = waveformTop - height * GAP_ABOVE_WAVEFORM;
    const maxTextY = captionBottom - minSafeZone - totalHeight;
    if (layout === 'top') {
      textY = Math.min(height * 0.28, maxTextY);
    } else if (layout === 'compact') {
      textY = maxTextY;
    } else {
      textY = Math.min(safePad + (captionBottom - safePad - totalHeight) / 2, maxTextY);
    }
    textY = Math.max(textY, safePad);
  } else {
    const waveformBottom = WAVEFORM_CENTER_Y_FLIPPED * height + height * WAVEFORM_MAX_AMP;
    const captionTop = waveformBottom + height * GAP_ABOVE_WAVEFORM;
    const captionBottom = height - safePad;
    const minTextY = captionTop;
    textY =
      layout === 'compact'
        ? minTextY
        : Math.max(minTextY, captionTop + (captionBottom - captionTop - totalHeight) / 2);
    textY = Math.min(textY, captionBottom - totalHeight);
  }

  ctx.textAlign = 'left';
  const leftX = padding;

  if (transition.prevText && transition.progress < 1) {
    ctx.globalAlpha = 1 - transition.progress;
    ctx.fillStyle = textColor;
    ctx.fillText(transition.prevText, leftX, textY + lineHeight / 2);
    ctx.globalAlpha = transition.progress;
  } else {
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = textColor;
  ctx.fillText(text, leftX, textY + lineHeight / 2);
  ctx.globalAlpha = 1;
}

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
    if (
      currentTime >= transcript[i].end &&
      (i === transcript.length - 1 || currentTime < transcript[i + 1].start)
    ) {
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

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
