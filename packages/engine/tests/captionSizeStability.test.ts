import { describe, it, expect } from 'vitest';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../src/types';
import { drawPhraseCutCaptions } from '../src/processing/captions/phraseCut';
import { drawProgressiveRevealCaptions } from '../src/processing/captions/progressiveReveal';
import { drawStaticHighlightCaptions } from '../src/processing/captions/staticHighlight';

/**
 * Caption type must hold one size for a whole video. A phrase that renders
 * smaller because it happens to be longer reads as glitchy — long text gets
 * more lines, never smaller type.
 */

function createMockCtx(): CanvasRenderingContext2D {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 20 });
      if (prop === 'roundRect') return undefined;
      return (...args: unknown[]) => calls.push({ method: prop, args });
    },
    set(_target, prop: string, value: unknown) {
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  };
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
}

function calls(ctx: CanvasRenderingContext2D) {
  return (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
}

/** The uniform scale the block was drawn at. */
function renderedScale(ctx: CanvasRenderingContext2D): number {
  const scale = calls(ctx).find((c) => c.method === 'scale');
  return scale ? Number(scale.args[0]) : 1;
}

function lineCount(ctx: CanvasRenderingContext2D): number {
  return new Set(calls(ctx).filter((c) => c.method === 'fillText').map((c) => Number(c.args[2]))).size;
}

const style: StyleConfig = {
  width: 1080,
  height: 1920,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 48,
  waveColor: '#ffffff',
  characterSpacing: 0,
  lineHeight: 1.3,
  textAlign: 'center',
  verticalAlign: 'auto',
  backgroundScrim: 'flat',
  captionStyleId: 'minimal-lower-third',
};

/** Phrases of wildly different length, back to back, as real speech produces. */
function buildGroups(phrases: string[]): { transcript: Word[]; groups: CaptionGroup[] } {
  const transcript: Word[] = [];
  const groups: CaptionGroup[] = [];
  let t = 0;

  for (const phrase of phrases) {
    const words = phrase.split(' ');
    const startIndex = transcript.length;
    const start = t;
    for (const text of words) {
      transcript.push({ text, start: t, end: t + 0.4 });
      t += 0.4;
    }
    groups.push({
      text: phrase,
      start,
      end: t,
      wordIndices: words.map((_, i) => startIndex + i),
    });
  }
  return { transcript, groups };
}

const PHRASES = [
  'Yes',
  'It really is',
  'a considerably longer stretch of speech that cannot possibly fit on one line',
  'Right',
];

describe('caption size stability', () => {
  it('phrase-cut renders every phrase at the same scale, however long', () => {
    const { transcript, groups } = buildGroups(PHRASES);

    const scales = groups.map((group) => {
      const ctx = createMockCtx();
      drawPhraseCutCaptions(
        ctx,
        (group.start + group.end) / 2,
        transcript,
        style,
        'top',
        false,
        false,
        groups
      );
      return renderedScale(ctx);
    });

    expect(new Set(scales).size, `scales varied per phrase: ${scales.join(', ')}`).toBe(1);
    expect(scales[0]).toBe(1);
  });

  it('phrase-cut wraps the long phrase instead of shrinking it', () => {
    const { transcript, groups } = buildGroups(PHRASES);
    const longGroup = groups[2];

    const ctx = createMockCtx();
    drawPhraseCutCaptions(
      ctx,
      (longGroup.start + longGroup.end) / 2,
      transcript,
      style,
      'top',
      false,
      false,
      groups
    );

    expect(lineCount(ctx)).toBeGreaterThan(1);
    expect(renderedScale(ctx)).toBe(1);
  });

  it('progressive-reveal holds its size across chunks of different width', () => {
    const { transcript } = buildGroups(PHRASES);
    const scales = [0.2, 2.0, 5.0].map((t) => {
      const ctx = createMockCtx();
      drawProgressiveRevealCaptions(
        ctx,
        t,
        transcript,
        { ...style, captionStyleId: 'editorial-reveal', chunkWords: 6 },
        'top',
        false,
        false,
        []
      );
      return renderedScale(ctx);
    });
    expect(new Set(scales).size).toBe(1);
  });

  it('static-highlight holds its size across chunks of different width', () => {
    const { transcript } = buildGroups(PHRASES);
    const scales = [0.2, 2.0, 5.0].map((t) => {
      const ctx = createMockCtx();
      drawStaticHighlightCaptions(
        ctx,
        t,
        transcript,
        { ...style, captionStyleId: 'cream-block', chunkWords: 6 },
        undefined,
        []
      );
      return renderedScale(ctx);
    });
    expect(new Set(scales).size).toBe(1);
  });

  it('still boosts a hook group — that scale change is intentional', () => {
    const { transcript, groups } = buildGroups(PHRASES);
    const hooked = groups.map((g, i) => (i === 1 ? { ...g, role: 'hook' as const } : g));

    const plain = createMockCtx();
    drawPhraseCutCaptions(plain, 0.2, transcript, style, 'top', false, false, hooked);
    const hook = createMockCtx();
    drawPhraseCutCaptions(hook, (hooked[1].start + hooked[1].end) / 2, transcript, style, 'top', false, false, hooked);

    expect(renderedScale(hook)).toBeGreaterThan(renderedScale(plain));
  });
});
