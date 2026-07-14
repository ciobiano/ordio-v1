import { describe, expect, it } from 'vitest';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '@/stores';
import {
  drawCaptions,
  drawSpotlightCaptions,
  drawStackCaptions,
  measureSpotlightCaptionBlock,
} from '@Ordio/engine/processing/captions';
import { getMaxCaptionTextWidth, SPOTLIGHT_WIDTH_RATIO } from '@Ordio/engine/processing/captions/shared';
import { drawKaraokeCaptions } from '@Ordio/engine/video/karaoke';

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

function getScaleCalls(ctx: CanvasRenderingContext2D): number[] {
  const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
  return calls
    .filter((call) => call.method === 'scale')
    .map((call) => Number(call.args[0]));
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

  it('phrase mode keeps pulse animation within the max caption width', () => {
    const ctx = createMockCtx();
    const phraseStyle: StyleConfig = {
      ...style,
      width: 360,
      height: 640,
      fontSize: 40,
    };
    const transcript: Word[] = [
      { text: 'Hyperdimensionalcaption', start: 0, end: 0.6 },
    ];

    drawCaptions(ctx, 0.075, transcript, phraseStyle, 'top', false, false, undefined, 'sweep-pulse');

    const measuredWidth = transcript[0].text.length * 20;
    const maxTextWidth = getMaxCaptionTextWidth(phraseStyle.width);
    const maxScaleForWidth = maxTextWidth / measuredWidth;
    const [appliedScale = 0] = getScaleCalls(ctx);
    expect(appliedScale).toBeLessThanOrEqual(maxScaleForWidth + 1e-6);
  });

  it('spotlight mode clamps long grouped rows to spotlight max width', () => {
    const ctx = createMockCtx();
    const transcript: Word[] = [{ text: 'stub', start: 0, end: 2 }];
    const groups: CaptionGroup[] = [
      { text: 'short before', start: 0, end: 0.6, wordIndices: [0] },
      {
        text: 'this is an intentionally oversized spotlight caption row',
        start: 0.6,
        end: 1.2,
        wordIndices: [0],
      },
      { text: 'short after', start: 1.2, end: 2, wordIndices: [0] },
    ];

    const metrics = measureSpotlightCaptionBlock(
      ctx,
      0.8,
      transcript,
      style,
      'top',
      false,
      groups
    );

    expect(metrics).not.toBeNull();
    expect(metrics!.blockWidth).toBeLessThanOrEqual(style.width * SPOTLIGHT_WIDTH_RATIO + 1e-6);
  });

  it('karaoke mode scales down when a line would exceed frame max width', () => {
    const ctx = createMockCtx();
    const karaokeStyle: StyleConfig = {
      ...style,
      width: 300,
      height: 500,
      fontSize: 36,
    };
    const transcript: Word[] = [
      { text: 'wide', start: 0, end: 0.4 },
      { text: 'wide', start: 0.4, end: 0.8 },
      { text: 'wide', start: 0.8, end: 1.2 },
    ];

    drawKaraokeCaptions(ctx, 0.1, transcript, karaokeStyle);

    const maxWidth = Math.min(karaokeStyle.width - 4, karaokeStyle.width * 0.84);
    const lineWidth = transcript.reduce((sum, word) => sum + word.text.length * 20, 0) + 2 * 20;
    const maxAllowedScale = maxWidth / lineWidth;
    const [layoutScale = 0] = getScaleCalls(ctx);
    expect(layoutScale).toBeLessThanOrEqual(maxAllowedScale + 1e-6);
  });
});
