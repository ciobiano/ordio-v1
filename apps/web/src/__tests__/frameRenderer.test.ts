import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFrame, type FrameOptions } from '@/lib/frameRenderer';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';

// Minimal canvas context mock
function createMockCtx(): CanvasRenderingContext2D {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') {
        return (text: string) => ({ width: text.length * 20 });
      }
      // Return a tracking function for any method
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

const defaultStyle: StyleConfig = {
  width: 1080,
  height: 1920,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 48,
  waveColor: '#3B82F6',
};

const sampleTranscript: Word[] = [
  { text: 'Hello', start: 0, end: 0.5 },
  { text: 'world', start: 0.5, end: 1.0 },
  { text: 'this', start: 1.0, end: 1.5 },
  { text: 'is', start: 1.5, end: 1.8 },
  { text: 'a', start: 1.8, end: 2.0 },
  { text: 'test', start: 2.0, end: 2.5 },
];

const sampleWaveform = Array.from({ length: 100 }, (_, i) =>
  Math.abs(Math.sin(i * 0.1))
);

function makeOptions(overrides?: Partial<FrameOptions>): FrameOptions {
  return {
    waveformData: sampleWaveform,
    transcript: sampleTranscript,
    style: defaultStyle,
    waveformStyle: 'bars',
    captionStyle: 'bottom',
    ...overrides,
  };
}

describe('renderFrame', () => {
  it('draws background as first operation', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

    renderFrame(ctx, 0, 90, makeOptions());

    // First fill should be the background
    const firstFillStyle = calls.find((c) => c.method === 'set:fillStyle');
    expect(firstFillStyle?.args[0]).toBe('#000000');

    const firstFillRect = calls.find((c) => c.method === 'fillRect');
    expect(firstFillRect?.args).toEqual([0, 0, 1080, 1920]);
  });

  it('renders without crashing for all waveform variants', () => {
    const variants = ['bars', 'spectrogram', 'circle'] as const;
    for (const variant of variants) {
      const ctx = createMockCtx();
      expect(() =>
        renderFrame(ctx, 15, 90, makeOptions({ waveformStyle: variant }))
      ).not.toThrow();
    }
  });

  it('renders without crashing for all caption variants', () => {
    const variants = ['bottom', 'center', 'karaoke'] as const;
    for (const variant of variants) {
      const ctx = createMockCtx();
      expect(() =>
        renderFrame(ctx, 15, 90, makeOptions({ captionStyle: variant }))
      ).not.toThrow();
    }
  });

  it('handles empty transcript gracefully', () => {
    const ctx = createMockCtx();
    expect(() =>
      renderFrame(ctx, 15, 90, makeOptions({ transcript: [] }))
    ).not.toThrow();
  });

  it('handles empty waveform data gracefully', () => {
    const ctx = createMockCtx();
    expect(() =>
      renderFrame(ctx, 15, 90, makeOptions({ waveformData: [] }))
    ).not.toThrow();
  });

  it('handles frame at the end of the video', () => {
    const ctx = createMockCtx();
    expect(() =>
      renderFrame(ctx, 89, 90, makeOptions())
    ).not.toThrow();
  });

  it('handles frame beyond duration', () => {
    const ctx = createMockCtx();
    expect(() =>
      renderFrame(ctx, 100, 90, makeOptions())
    ).not.toThrow();
  });

  it('draws fillText for captions when transcript exists', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;

    renderFrame(ctx, 15, 90, makeOptions());

    const fillTextCalls = calls.filter((c) => c.method === 'fillText');
    expect(fillTextCalls.length).toBeGreaterThan(0);
  });
});
