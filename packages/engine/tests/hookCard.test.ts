import { describe, it, expect } from 'vitest';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../src/types';
import { drawWordSwapCaptions } from '../src/processing/captions/wordSwap';
import { drawPhraseCutCaptions } from '../src/processing/captions/phraseCut';
import { drawStaticHighlightCaptions } from '../src/processing/captions/staticHighlight';
import { HOOK_SCALE_MULTIPLIER } from '../src/processing/captions/shared';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 20 });
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

function getScaleCalls(ctx: CanvasRenderingContext2D): number[] {
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
  return calls.filter((c) => c.method === 'scale').map((c) => Number(c.args[0]));
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
  lineHeight: 1.4,
  textAlign: 'center',
  verticalAlign: 'auto',
  captionStyleId: 'word-pop',
};

describe('Hook Card scale boost', () => {
  it('word-swap: a hook group scales the active word up relative to a non-hook group', () => {
    const transcript: Word[] = [{ text: 'wait', start: 0, end: 0.3 }];

    const bodyGroups: CaptionGroup[] = [{ text: 'wait', start: 0, end: 0.3, wordIndices: [0] }];
    const ctxBody = createMockCtx();
    drawWordSwapCaptions(ctxBody, 0.1, transcript, style, 'top', false, false, bodyGroups);
    const [bodyScale] = getScaleCalls(ctxBody);

    const hookGroups: CaptionGroup[] = [{ text: 'wait', start: 0, end: 0.3, wordIndices: [0], role: 'hook' }];
    const ctxHook = createMockCtx();
    drawWordSwapCaptions(ctxHook, 0.1, transcript, style, 'top', false, false, hookGroups);
    const [hookScale] = getScaleCalls(ctxHook);

    expect(hookScale).toBeCloseTo(bodyScale * HOOK_SCALE_MULTIPLIER, 5);
  });

  it('phrase-cut: a hook group scales the chunk up relative to a non-hook group', () => {
    const outlineStyle: StyleConfig = { ...style, captionStyleId: 'bold-outline' };
    const transcript: Word[] = [
      { text: 'this', start: 0, end: 0.3 },
      { text: 'matters', start: 0.3, end: 0.6 },
    ];

    const bodyGroups: CaptionGroup[] = [{ text: 'this matters', start: 0, end: 0.6, wordIndices: [0, 1] }];
    const ctxBody = createMockCtx();
    drawPhraseCutCaptions(ctxBody, 0.1, transcript, outlineStyle, 'top', false, false, bodyGroups);
    const [bodyScale] = getScaleCalls(ctxBody);

    const hookGroups: CaptionGroup[] = [
      { text: 'this matters', start: 0, end: 0.6, wordIndices: [0, 1], role: 'hook' },
    ];
    const ctxHook = createMockCtx();
    drawPhraseCutCaptions(ctxHook, 0.1, transcript, outlineStyle, 'top', false, false, hookGroups);
    const [hookScale] = getScaleCalls(ctxHook);

    expect(hookScale).toBeCloseTo(bodyScale * HOOK_SCALE_MULTIPLIER, 5);
  });

  it('static-highlight: a hook group scales the whole block up relative to a non-hook group', () => {
    const karaokeStyle: StyleConfig = { ...style, captionStyleId: 'karaoke-chip' };
    const transcript: Word[] = [
      { text: 'so', start: 0, end: 0.2 },
      { text: 'i', start: 0.2, end: 0.3 },
      { text: 'tried', start: 0.3, end: 0.6 },
    ];

    const bodyGroups: CaptionGroup[] = [{ text: 'so i tried', start: 0, end: 0.6, wordIndices: [0, 1, 2] }];
    const ctxBody = createMockCtx();
    drawStaticHighlightCaptions(ctxBody, 0.1, transcript, karaokeStyle, undefined, bodyGroups);
    const [bodyScale] = getScaleCalls(ctxBody);

    const hookGroups: CaptionGroup[] = [
      { text: 'so i tried', start: 0, end: 0.6, wordIndices: [0, 1, 2], role: 'hook' },
    ];
    const ctxHook = createMockCtx();
    drawStaticHighlightCaptions(ctxHook, 0.1, transcript, karaokeStyle, undefined, hookGroups);
    const [hookScale] = getScaleCalls(ctxHook);

    expect(hookScale).toBeCloseTo(bodyScale * HOOK_SCALE_MULTIPLIER, 5);
  });
});
