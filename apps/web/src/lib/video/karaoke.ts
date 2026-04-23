import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '@/stores/types';

const CAPTION_PADDING = 0.08;
const FONT_WEIGHT = '600';
const KARAOKE_MAX_LINES = 3;
const KARAOKE_MIN_WORDS_PER_LINE = 3;
const KARAOKE_MAX_SCENE_WORDS = 15;
const KARAOKE_SENTENCE_RE = /[.?!;]$/;
const KARAOKE_PAGE_FADE_DURATION = 0.15;
const KARAOKE_INACTIVE_ALPHA = 0.65;
const KARAOKE_STROKE_COLOR = 'rgba(0,0,0,0.85)';

/** Damped spring ease — fast entry with a small overshoot, settles quickly. */
function springEase(t: number): number {
  return 1 - Math.exp(-8 * t) * Math.cos(12 * t);
}

function getKaraokeScene(transcript: Word[], currentTime: number): Word[] {
  if (transcript.length === 0) return [];

  let currentIdx = 0;
  for (let i = 0; i < transcript.length; i++) {
    if (currentTime >= transcript[i].start) currentIdx = i;
    else break;
  }

  let sceneStart = 0;
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (KARAOKE_SENTENCE_RE.test(transcript[i].text.trim())) {
      sceneStart = i + 1;
      break;
    }
  }

  let sceneEnd = Math.min(sceneStart + KARAOKE_MAX_SCENE_WORDS, transcript.length);
  for (let i = sceneStart; i < transcript.length; i++) {
    if (KARAOKE_SENTENCE_RE.test(transcript[i].text.trim())) {
      sceneEnd = i + 1;
      break;
    }
  }

  return transcript.slice(sceneStart, sceneEnd);
}

type KaraokeWord = { text: string; start: number; end: number; wordWidth: number };

function buildKaraokeLines(
  words: KaraokeWord[],
  spaceWidth: number,
  maxWidth: number
): KaraokeWord[][] {
  const lines: KaraokeWord[][] = [];
  let line: KaraokeWord[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const needed = line.length === 0 ? word.wordWidth : lineWidth + spaceWidth + word.wordWidth;
    const prevIsSentenceEnd =
      line.length > 0 && KARAOKE_SENTENCE_RE.test(line[line.length - 1].text.trim());
    const widthOverflow = line.length >= KARAOKE_MIN_WORDS_PER_LINE && needed > maxWidth;

    if (line.length > 0 && (prevIsSentenceEnd || widthOverflow)) {
      lines.push(line);
      line = [word];
      lineWidth = word.wordWidth;
    } else {
      line.push(word);
      lineWidth = needed;
    }
  }
  if (line.length > 0) lines.push(line);

  return lines;
}

export function drawKaraokeCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[]
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize, lineSpacing = 0, lineHeight: lineHeightMultiplier = 1.4 } = style;
  const padding = width * CAPTION_PADDING;
  const maxWidth = width - padding * 2;

  // Use groups to determine active scene if provided
  let scene: Word[];
  if (groups && groups.length > 0) {
    const activeGroup = groups.find(g => currentTime >= g.start && currentTime < g.end);
    if (activeGroup) {
      scene = activeGroup.wordIndices.map(i => transcript[i]).filter(Boolean);
    } else {
      // Find the next upcoming group
      const nextGroup = groups.find(g => g.start > currentTime);
      if (nextGroup) {
        scene = nextGroup.wordIndices.slice(0, KARAOKE_MAX_SCENE_WORDS).map(i => transcript[i]).filter(Boolean);
      } else {
        scene = transcript.slice(0, KARAOKE_MAX_SCENE_WORDS);
      }
    }
  } else {
    scene = getKaraokeScene(transcript, currentTime);
  }
  if (scene.length === 0) return;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const spaceWidth = ctx.measureText(' ').width;
  const lineHeight = fontSize * lineHeightMultiplier + lineSpacing;

  const measured: KaraokeWord[] = scene.map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    wordWidth: ctx.measureText(w.text).width,
  }));

  const allLines = buildKaraokeLines(measured, spaceWidth, maxWidth);

  let lastRevealedLine = 0;
  for (let li = 0; li < allLines.length; li++) {
    if (allLines[li].some((w) => w.start <= currentTime)) {
      lastRevealedLine = li;
    }
  }

  const activePage = Math.floor(lastRevealedLine / KARAOKE_MAX_LINES);
  const pageStart = activePage * KARAOKE_MAX_LINES;
  const pageLines = allLines.slice(pageStart, pageStart + KARAOKE_MAX_LINES);

  const pageFirstWordStart = pageLines[0]?.[0]?.start ?? currentTime;
  const timeSincePageStart = Math.max(0, currentTime - pageFirstWordStart);
  const pageFade = Math.min(1, timeSincePageStart / KARAOKE_PAGE_FADE_DURATION);

  const strokeWidth = Math.max(4, fontSize * 0.08);
  const topPad = height * CAPTION_PADDING;

  for (let li = 0; li < pageLines.length; li++) {
    const lineY = topPad + li * lineHeight + lineHeight / 2;
    let x = padding;

    for (const word of pageLines[li]) {
      const isVisible = word.start <= currentTime;
      const isActive = isVisible && currentTime < word.end;

      const wordX = x;
      x += word.wordWidth + spaceWidth;

      if (!isVisible) continue;

      const fillColor = isActive ? style.waveColor : textColor;
      const wordAlpha = isActive ? 1.0 : KARAOKE_INACTIVE_ALPHA;

      let scale = 1.0;
      if (isActive) {
        const wordDuration = Math.max(0.05, word.end - word.start);
        const progress = Math.min(1, ((currentTime - word.start) / wordDuration) * 4);
        scale = 1 + 0.12 * springEase(progress);
      }

      ctx.save();
      ctx.globalAlpha = wordAlpha * pageFade;

      if (scale !== 1.0) {
        const cx = wordX + word.wordWidth / 2;
        ctx.translate(cx, lineY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -lineY);
      }

      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = KARAOKE_STROKE_COLOR;
      ctx.strokeText(word.text, wordX, lineY);

      ctx.fillStyle = fillColor;
      ctx.fillText(word.text, wordX, lineY);

      ctx.restore();
    }
  }

  ctx.globalAlpha = 1.0;
}
