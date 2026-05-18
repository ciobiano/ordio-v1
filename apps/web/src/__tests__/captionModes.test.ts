import { describe, expect, it } from 'vitest';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '@/stores';
import {
  drawSpotlightCaptions,
  drawStackCaptions,
} from '@/lib/processing/captions';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') {
        return (text: string) => ({ width: text.length * 20 });
      }
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

function getFillTextCalls(ctx: CanvasRenderingContext2D): string[] {
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
  return calls
    .filter((call) => call.method === 'fillText')
    .map((call) => String(call.args[0]));
}

const style: StyleConfig = {
  width: 400,
  height: 800,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 40,
  waveColor: '#3B82F6',
  characterSpacing: 0,
  lineHeight: 1.3,
};

describe('caption modes', () => {
  it('stack mode wraps only the spoken portion of the active sentence', () => {
    const ctx = createMockCtx();
    const transcript: Word[] = [
      { text: 'If', start: 0, end: 0.3 },
      { text: 'you', start: 0.3, end: 0.6 },
      { text: 'want', start: 0.6, end: 0.9 },
      { text: 'to', start: 0.9, end: 1.2 },
      { text: 'be', start: 1.2, end: 1.5 },
      { text: 'credible.', start: 1.5, end: 1.9 },
    ];

    drawStackCaptions(ctx, 1.0, transcript, style);

    const renderedText = getFillTextCalls(ctx).join(' ');
    expect(renderedText).toContain('If');
    expect(renderedText).toContain('you');
    expect(renderedText).toContain('want');
    expect(renderedText).toContain('to');
    expect(renderedText).not.toContain('credible.');
  });

  it('spotlight mode respects editorial groups for previous/current/next rows', () => {
    const ctx = createMockCtx();
    const transcript: Word[] = [
      { text: 'First', start: 0, end: 0.3 },
      { text: 'phrase', start: 0.3, end: 0.6 },
      { text: 'Second', start: 0.6, end: 0.9 },
      { text: 'phrase', start: 0.9, end: 1.2 },
      { text: 'Third', start: 1.2, end: 1.5 },
      { text: 'phrase', start: 1.5, end: 1.8 },
    ];
    const groups: CaptionGroup[] = [
      { text: 'First phrase', start: 0, end: 0.6, wordIndices: [0, 1] },
      { text: 'Second phrase', start: 0.6, end: 1.2, wordIndices: [2, 3] },
      { text: 'Third phrase', start: 1.2, end: 1.8, wordIndices: [4, 5] },
    ];

    drawSpotlightCaptions(ctx, 0.8, transcript, style, 'top', false, groups);

    expect(getFillTextCalls(ctx)).toEqual(
      expect.arrayContaining(['First phrase', 'Second phrase', 'Third phrase'])
    );
  });
});
