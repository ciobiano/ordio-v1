import { describe, it, expect } from 'vitest';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import {
  CAPTION_BOTTOM_ANCHOR_RATIO,
  CAPTION_VERTICAL_SAFE_RATIO,
  dimColor,
  getCaptionSideMargin,
  PROGRESSIVE_REVEAL_DIM_OPACITY,
  resolveBlockTopForAlign,
  resolveLineX,
  resolveScalePivotX,
  scaleAboutPivot,
} from '../src/processing/captions/shared';
import { drawProgressiveRevealCaptions } from '../src/processing/captions/progressiveReveal';
import { drawStaticHighlightCaptions } from '../src/processing/captions/staticHighlight';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 20 });
      if (prop === 'roundRect') return undefined;
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
      };
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

/** Fill colors in the order they were assigned, paired with the text drawn after each. */
function drawnWords(ctx: CanvasRenderingContext2D): Array<{ text: string; fill: string }> {
  const out: Array<{ text: string; fill: string }> = [];
  let fill = '';
  for (const call of calls(ctx)) {
    if (call.method === 'set:fillStyle') fill = String(call.args[0]);
    if (call.method === 'fillText') out.push({ text: String(call.args[0]), fill });
  }
  return out;
}

const WIDTH = 1080;
const HEIGHT = 1920;

const baseStyle: StyleConfig = {
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 48,
  waveColor: '#ffffff',
  characterSpacing: 0,
  lineHeight: 1.2,
  textAlign: 'center',
  verticalAlign: 'auto',
  captionStyleId: 'editorial-reveal',
};

const transcript: Word[] = [
  { text: 'Every', start: 0, end: 1 },
  { text: 'model', start: 1, end: 2 },
  { text: 'has', start: 2, end: 3 },
  { text: 'a', start: 3, end: 4 },
  { text: 'place.', start: 4, end: 5 },
];

describe('resolveLineX', () => {
  const margin = 60;

  it('anchors start at the safe margin regardless of line width', () => {
    expect(resolveLineX('start', 100, WIDTH, margin)).toBe(margin);
    expect(resolveLineX('start', 900, WIDTH, margin)).toBe(margin);
  });

  it('anchors end so the line finishes on the safe margin', () => {
    expect(resolveLineX('end', 100, WIDTH, margin)).toBe(WIDTH - margin - 100);
    expect(resolveLineX('end', 100, WIDTH, margin) + 100).toBe(WIDTH - margin);
  });

  it('centers each line on its own width', () => {
    expect(resolveLineX('center', 200, WIDTH, margin)).toBe((WIDTH - 200) / 2);
  });
});

describe('resolveScalePivotX', () => {
  const margin = 60;

  it('pins the anchored edge so scaling never pushes text past its margin', () => {
    // A start-aligned line scaled up must still begin exactly on the margin.
    const lineX = resolveLineX('start', 300, WIDTH, margin);
    const pivot = resolveScalePivotX('start', WIDTH, margin);
    expect(scaleAboutPivot(lineX, pivot, 1.4)).toBe(margin);

    const endX = resolveLineX('end', 300, WIDTH, margin);
    const endPivot = resolveScalePivotX('end', WIDTH, margin);
    expect(scaleAboutPivot(endX + 300, endPivot, 1.4)).toBe(WIDTH - margin);
  });

  it('keeps centered captions pivoting on the canvas center', () => {
    expect(resolveScalePivotX('center', WIDTH, margin)).toBe(WIDTH / 2);
  });

  it('agrees with resolveLineX on which margin each alignment owns', () => {
    expect(resolveScalePivotX('start', WIDTH, margin)).toBe(resolveLineX('start', 0, WIDTH, margin));
    expect(resolveScalePivotX('end', WIDTH, margin)).toBe(resolveLineX('end', 0, WIDTH, margin));
  });
});

describe('resolveBlockTopForAlign', () => {
  const blockHeight = 200;

  it('returns null for auto so each mechanic keeps its own placement', () => {
    expect(resolveBlockTopForAlign('auto', HEIGHT, blockHeight, 0.18)).toBeNull();
  });

  it('anchors bottom at the design 22% from the base', () => {
    const top = resolveBlockTopForAlign('bottom', HEIGHT, blockHeight, 0.18);
    expect(top).toBe(HEIGHT * (1 - CAPTION_BOTTOM_ANCHOR_RATIO) - blockHeight);
  });

  it('never lets a block escape the vertical safe area', () => {
    const tall = HEIGHT; // taller than the frame's usable space
    for (const align of ['top', 'center', 'bottom'] as const) {
      const top = resolveBlockTopForAlign(align, HEIGHT, tall, 0.18);
      expect(top).toBeGreaterThanOrEqual(HEIGHT * CAPTION_VERTICAL_SAFE_RATIO);
    }
  });
});

describe('dimColor', () => {
  it('converts hex to rgba at the given alpha', () => {
    expect(dimColor('#ffffff', 0.32)).toBe('rgba(255, 255, 255, 0.32)');
    expect(dimColor('#690C05', 0.5)).toBe('rgba(105, 12, 5, 0.5)');
  });

  it('returns the input untouched when it is not parseable 6-digit hex', () => {
    expect(dimColor('rgba(0,0,0,1)', 0.3)).toBe('rgba(0,0,0,1)');
    expect(dimColor('#fff', 0.3)).toBe('#fff');
  });
});

describe('progressive-reveal mechanic', () => {
  it('holds the whole sentence, dim before each word is spoken and lit after', () => {
    const ctx = createMockCtx();
    // Two words spoken, three still upcoming.
    drawProgressiveRevealCaptions(ctx, 1.5, transcript, baseStyle, 'top', false, false, []);

    const words = drawnWords(ctx);
    expect(words.map((w) => w.text)).toEqual(['Every', 'model', 'has', 'a', 'place.']);

    const dim = dimColor('#ffffff', PROGRESSIVE_REVEAL_DIM_OPACITY);
    expect(words.find((w) => w.text === 'Every')?.fill).toBe('#ffffff');
    expect(words.find((w) => w.text === 'model')?.fill).toBe('#ffffff');
    expect(words.find((w) => w.text === 'has')?.fill).toBe(dim);
    expect(words.find((w) => w.text === 'place.')?.fill).toBe(dim);
  });

  it('flips a word at its own start with no intermediate easing', () => {
    const before = createMockCtx();
    drawProgressiveRevealCaptions(before, 1.99, transcript, baseStyle, 'top', false, false, []);
    const after = createMockCtx();
    drawProgressiveRevealCaptions(after, 2.0, transcript, baseStyle, 'top', false, false, []);

    const dim = dimColor('#ffffff', PROGRESSIVE_REVEAL_DIM_OPACITY);
    expect(drawnWords(before).find((w) => w.text === 'has')?.fill).toBe(dim);
    expect(drawnWords(after).find((w) => w.text === 'has')?.fill).toBe('#ffffff');
  });

  it('honors an explicit vertical anchor over the default placement', () => {
    const centered = createMockCtx();
    drawProgressiveRevealCaptions(centered, 1.5, transcript, baseStyle, 'top', false, false, []);
    const bottom = createMockCtx();
    drawProgressiveRevealCaptions(
      bottom,
      1.5,
      transcript,
      { ...baseStyle, verticalAlign: 'bottom' },
      'top',
      false,
      false,
      []
    );

    const yOf = (ctx: CanvasRenderingContext2D) =>
      calls(ctx).find((c) => c.method === 'fillText')?.args[2] as number;
    expect(yOf(bottom)).toBeGreaterThan(yOf(centered));
  });

  it('aligns each line independently rather than as one ragged block', () => {
    const start = createMockCtx();
    drawProgressiveRevealCaptions(
      start,
      1.5,
      transcript,
      { ...baseStyle, textAlign: 'start' },
      'top',
      false,
      false,
      []
    );
    const firstX = calls(start).find((c) => c.method === 'fillText')?.args[1] as number;
    expect(firstX).toBeCloseTo(getCaptionSideMargin(WIDTH), 5);
  });
});

describe('cream-block chip', () => {
  it('inverts the chip text and drops the idle shadow that smudges a light surface', () => {
    const ctx = createMockCtx();
    drawStaticHighlightCaptions(
      ctx,
      1.5,
      transcript,
      { ...baseStyle, captionStyleId: 'cream-block', textColor: '#690C05' },
      undefined,
      []
    );

    const fills = calls(ctx)
      .filter((c) => c.method === 'set:fillStyle')
      .map((c) => String(c.args[0]));
    expect(fills).toContain('#690C05'); // chip fill + idle word color
    expect(fills).toContain('#FAF7EE'); // active word sits on the chip

    const shadows = calls(ctx).filter((c) => c.method === 'set:shadowColor');
    expect(shadows).toHaveLength(0);
  });

  it('keeps karaoke-chip on its original dark-on-chip treatment', () => {
    const ctx = createMockCtx();
    drawStaticHighlightCaptions(
      ctx,
      1.5,
      transcript,
      { ...baseStyle, captionStyleId: 'karaoke-chip' },
      undefined,
      []
    );

    const fills = calls(ctx)
      .filter((c) => c.method === 'set:fillStyle')
      .map((c) => String(c.args[0]));
    expect(fills).toContain('#111111');
    expect(calls(ctx).filter((c) => c.method === 'set:shadowColor').length).toBeGreaterThan(0);
  });
});
