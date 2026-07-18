import { describe, expect, it, vi } from 'vitest';
import { drawSpacedText, measureTextWidth } from '@Ordio/engine/video/textLayout';

function makeContext() {
  const calls: Array<{ text: string; x: number }> = [];
  const ctx = {
    measureText: vi.fn((text: string) => ({ width: text === ' ' ? 5 : 10 })),
    fillText: vi.fn((text: string, x: number) => calls.push({ text, x })),
    strokeText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    textAlign: 'left' as CanvasTextAlign,
  };

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('textLayout', () => {
  it('tightens characters without collapsing spaces for negative character spacing', () => {
    const { ctx, calls } = makeContext();

    expect(measureTextWidth(ctx, 'AB CD', -2)).toBe(41);

    drawSpacedText(ctx, 'AB CD', 0, 0, { characterSpacing: -2 });

    expect(calls).toEqual([
      { text: 'A', x: 0 },
      { text: 'B', x: 8 },
      { text: ' ', x: 18 },
      { text: 'C', x: 23 },
      { text: 'D', x: 31 },
    ]);
  });
});
