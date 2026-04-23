import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup } from '@/stores';
import {
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
  GAP_ABOVE_WAVEFORM,
} from '@/lib/waveforms/constants';

const CAPTION_PADDING = 0.08;
const FONT_WEIGHT = '600';
const MIN_CAPTION_SAFE_ZONE = 0.02;
const PHRASE_FADE_DURATION = 0.15;
const WORDS_PER_PHRASE = 6;
function getPhraseTransition(
  transcript: Word[],
  currentTime: number,
  groups?: CaptionGroup[] | undefined
): { currentText: string; prevText: string; progress: number; groupIndex: number } {
  // If we have custom groups, use them (no fading, instant cut)
  if (groups && groups.length > 0) {
    const currentGroupIdx = groups.findIndex(
      g => currentTime >= g.start && currentTime < g.end
    );
    
    if (currentGroupIdx >= 0) {
      return { 
        currentText: groups[currentGroupIdx].text, 
        prevText: '', 
        progress: 1, 
        groupIndex: currentGroupIdx 
      };
    }
    
    // Find next upcoming group if we are in a gap
    const nextGroupIdx = groups.findIndex(g => g.start > currentTime);
    if (nextGroupIdx > 0) {
      return { 
        currentText: '', 
        prevText: groups[nextGroupIdx - 1].text, 
        progress: 1, 
        groupIndex: -1 
      };
    }
    
    // Past all groups
    if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
      return {
        currentText: '',
        prevText: groups[groups.length - 1].text,
        progress: 1,
        groupIndex: -1
      };
    }

    return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
  }
  
  // Fallback: auto-phrase grouping (6 words per phrase)
  const currentIdx = findCurrentPhraseIndex(transcript, currentTime, WORDS_PER_PHRASE);
  
  if (currentIdx >= 0) {
    const start = currentIdx * WORDS_PER_PHRASE;
    const end = Math.min(start + WORDS_PER_PHRASE, transcript.length);
    const text = transcript.slice(start, end).map(w => w.text).join(' ');
    
    // Calculate pure time-based fade
    const firstWordStart = transcript[start].start;
    const timeSinceStart = currentTime - firstWordStart;
    const progress = Math.min(1, Math.max(0, timeSinceStart / PHRASE_FADE_DURATION));
    
    let prevText = '';
    if (progress < 1 && currentIdx > 0) {
      const prevStart = (currentIdx - 1) * WORDS_PER_PHRASE;
      const prevEnd = Math.min(prevStart + WORDS_PER_PHRASE, transcript.length);
      prevText = transcript.slice(prevStart, prevEnd).map(w => w.text).join(' ');
    }
    
    return { currentText: text, prevText, progress, groupIndex: currentIdx };
  }

  // Find the last active phrase if we are past the end
  if (transcript.length > 0 && currentTime >= transcript[transcript.length - 1].end) {
    const lastIdx = Math.floor((transcript.length - 1) / WORDS_PER_PHRASE);
    const start = lastIdx * WORDS_PER_PHRASE;
    const text = transcript.slice(start).map(w => w.text).join(' ');
    return { currentText: '', prevText: text, progress: 1, groupIndex: -1 };
  }

  return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[] | undefined
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize, lineSpacing = 0, lineHeight: lineHeightMultiplier = 1.4 } = style;
  const padding = width * CAPTION_PADDING;

  const transition = getPhraseTransition(transcript, currentTime, groups);
  if (!transition.currentText && !transition.prevText) return;

  const text = transition.currentText || transition.prevText;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = width - padding * 2;
  const wrappedLines = wrapText(ctx, text, maxTextWidth);
  const lineHeight = fontSize * lineHeightMultiplier + lineSpacing;
  const totalHeight = wrappedLines.length * lineHeight;
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

  const renderText = (linesToRender: string[], alpha: number) => {
    ctx.globalAlpha = alpha;
    linesToRender.forEach((line, idx) => {
      ctx.fillStyle = textColor;
      ctx.fillText(line, leftX, textY + idx * lineHeight + lineHeight / 2);
    });
    ctx.globalAlpha = 1;
  };

  if (transition.prevText && transition.progress < 1) {
    const prevWrapped = wrapText(ctx, transition.prevText, maxTextWidth);
    renderText(prevWrapped, 1 - transition.progress);
  }

  renderText(wrappedLines, transition.progress);
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
      const canBreakAtPunctuation = /[.,;!?]$/.test(currentLine);
      if (canBreakAtPunctuation) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}
