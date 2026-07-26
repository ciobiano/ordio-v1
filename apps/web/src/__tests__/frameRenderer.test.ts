import { describe, it, expect, vi } from 'vitest';
import { renderFrame, type FrameOptions } from '@Ordio/engine/video';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '@Ordio/engine/types';

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
  characterSpacing: 0,
  lineHeight: 1.4,
  captionStyleId: 'minimal-lower-third',
};

const sampleTranscript: Word[] = [
  { text: 'Hello', start: 0, end: 0.5 },
  { text: 'world', start: 0.5, end: 1.0 },
  { text: 'this', start: 1.0, end: 1.5 },
  { text: 'is', start: 1.5, end: 1.8 },
  { text: 'a', start: 1.8, end: 2.0 },
  { text: 'test', start: 2.0, end: 2.5 },
];

const sampleWaveform = Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i * 0.1)));

// phrase-cut (the default caption style's mechanic) requires captionGroups —
// always populated post-transcription in the real app; this mirrors that.
const sampleCaptionGroups: CaptionGroup[] = [
  { text: 'Hello world this is a test', start: 0, end: 2.5, wordIndices: [0, 1, 2, 3, 4, 5] },
];

function makeOptions(overrides?: Partial<FrameOptions>): FrameOptions {
  return {
    waveformData: sampleWaveform,
    transcript: sampleTranscript,
    style: defaultStyle,
    waveformStyle: 'bars',
    captionGroups: sampleCaptionGroups,
    ...overrides,
  };
}

describe('renderFrame', () => {
  it('draws background as first operation', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    renderFrame(ctx, 0, 90, makeOptions());

    // First fill should be the background
    const firstFillStyle = calls.find((c) => c.method === 'set:fillStyle');
    expect(firstFillStyle?.args[0]).toBe('#000000');

    const firstFillRect = calls.find((c) => c.method === 'fillRect');
    expect(firstFillRect?.args).toEqual([0, 0, 1080, 1920]);
  });

  it('applies the shape-drift transform for a preset-image background but not a custom one', () => {
    // Caption mechanics (wordSwap/phraseCut/staticHighlight) also call ctx.rotate() for their
    // own word-tilt effect, so a bare "was rotate called" assertion can't isolate the
    // background-drift transform — compare call counts between preset and custom instead,
    // holding everything else (captions, layout, time) identical.
    const runWithSource = (source: 'preset' | 'custom') => {
      const ctx = createMockCtx();
      const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
        .__calls;
      const fakeImage = { width: 1227, height: 1228 } as unknown as HTMLImageElement;
      renderFrame(
        ctx,
        30,
        90,
        makeOptions({
          style: {
            ...defaultStyle,
            background:
              source === 'preset'
                ? { type: 'image', source: 'preset', assetId: 'bow' }
                : { type: 'image', source: 'custom', assetId: 'abc123' },
          },
          backgroundFrame: fakeImage,
        })
      );
      return calls.filter((c) => c.method === 'rotate').length;
    };

    const presetRotateCount = runWithSource('preset');
    const customRotateCount = runWithSource('custom');

    expect(presetRotateCount).toBe(customRotateCount + 1);
  });

  it('wraps the preset drift transform in save/restore', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;
    const fakeImage = { width: 1227, height: 1228 } as unknown as HTMLImageElement;

    renderFrame(
      ctx,
      30,
      90,
      makeOptions({
        style: {
          ...defaultStyle,
          background: { type: 'image', source: 'preset', assetId: 'bow' },
        },
        backgroundFrame: fakeImage,
      })
    );

    expect(calls.some((c) => c.method === 'save')).toBe(true);
    expect(calls.some((c) => c.method === 'restore')).toBe(true);
  });

  it('renders without crashing for all waveform variants', () => {
    const variants = ['bars', 'spectrogram', 'circle'] as const;
    for (const variant of variants) {
      const ctx = createMockCtx();
      expect(() => renderFrame(ctx, 15, 90, makeOptions({ waveformStyle: variant }))).not.toThrow();
    }
  });

  it('renders without crashing for all canvas layouts', () => {
    const layouts = ['top', 'compact', 'flipped'] as const;
    for (const layout of layouts) {
      const ctx = createMockCtx();
      expect(() => renderFrame(ctx, 15, 90, makeOptions({ canvasLayout: layout }))).not.toThrow();
    }
  });

  it('renders without crashing for all caption styles', () => {
    const styleIds = [
      'word-pop',
      'bold-outline',
      'karaoke-chip',
      'minimal-lower-third',
      'big-statement',
      'script-accent',
    ] as const;
    for (const captionStyleId of styleIds) {
      const ctx = createMockCtx();
      expect(() =>
        renderFrame(ctx, 15, 90, makeOptions({ style: { ...defaultStyle, captionStyleId } }))
      ).not.toThrow();
    }
  });

  it('does not draw waveform geometry in a static-highlight (full-screen) caption style', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    renderFrame(
      ctx,
      15,
      90,
      makeOptions({ style: { ...defaultStyle, captionStyleId: 'karaoke-chip' }, waveformStyle: 'bars' })
    );

    expect(calls.some((c) => c.method === 'arcTo')).toBe(false);
  });

  it('handles empty transcript gracefully', () => {
    const ctx = createMockCtx();
    expect(() => renderFrame(ctx, 15, 90, makeOptions({ transcript: [] }))).not.toThrow();
  });

  it('handles empty waveform data gracefully', () => {
    const ctx = createMockCtx();
    expect(() => renderFrame(ctx, 15, 90, makeOptions({ waveformData: [] }))).not.toThrow();
  });

  it('handles frame at the end of the video', () => {
    const ctx = createMockCtx();
    expect(() => renderFrame(ctx, 89, 90, makeOptions())).not.toThrow();
  });

  it('handles frame beyond duration', () => {
    const ctx = createMockCtx();
    expect(() => renderFrame(ctx, 100, 90, makeOptions())).not.toThrow();
  });

  it('draws fillText for captions when transcript exists', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    renderFrame(ctx, 15, 90, makeOptions());

    const fillTextCalls = calls.filter((c) => c.method === 'fillText');
    expect(fillTextCalls.length).toBeGreaterThan(0);
  });

  it('renders watermark at top-left with "Ordio by Kaine Studio" in Geist font', () => {
    const ctx = createMockCtx();
    const options = makeOptions({ showWatermark: true });
    renderFrame(ctx, 0, 90, options);

    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    const fillTextCall = calls.find(
      (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio'
    );
    expect(fillTextCall).toBeDefined();
    expect(fillTextCall?.args[1]).toBe(16); // x
    expect(fillTextCall?.args[2]).toBe(16); // y

    const fontSet = calls.find(
      (c) => c.method === 'set:font' && String(c.args[0]).includes('Geist')
    );
    expect(fontSet).toBeDefined();

    const arcCall = calls.find((c) => c.method === 'arc');
    expect(arcCall).toBeUndefined();
  });

  it('renders without crashing when graphicStyle is set', () => {
    const ctx = createMockCtx();
    expect(() =>
      renderFrame(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame1' }))
    ).not.toThrow();
  });

  it('does not call waveform drawing when graphicStyle is set', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    // No image in cache — getGraphic returns null — so drawImage is not called
    renderFrame(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame1', waveformStyle: 'bars' }));
    expect(calls.some((c) => c.method === 'drawImage')).toBe(false);
  });

  it('captions still render when graphicStyle is set', () => {
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    renderFrame(ctx, 15, 90, makeOptions({ graphicStyle: 'graphic-frame1' }));

    const fillTextCalls = calls.filter((c) => c.method === 'fillText');
    expect(fillTextCalls.length).toBeGreaterThan(0);
  });

  it('calls ctx.drawImage when graphicStyle is set and image is in cache', async () => {
    // vi.mock() is hoisted — use vi.doMock() + vi.resetModules() + dynamic import instead
    vi.resetModules();
    vi.doMock('@Ordio/engine/loaders/graphicLoader', () => ({
      getGraphic: vi.fn(() =>
        Object.assign(new EventTarget(), {
          src: '/graphic-styles/frame2.svg',
          naturalWidth: 321,
          naturalHeight: 189,
        })
      ),
      loadGraphic: vi.fn(),
    }));

    const { renderFrame: renderFrameFresh } = await import('@Ordio/engine/video');
    const ctx = createMockCtx();
    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    renderFrameFresh(ctx, 0, 90, makeOptions({ graphicStyle: 'graphic-frame2' }));

    // direct path (frame2): ctx.drawImage(img, x, y, w, h) is called
    expect(calls.some((c) => c.method === 'drawImage')).toBe(true);

    vi.resetModules();
  });

  it('does not render watermark when showWatermark is false or omitted', () => {
    const ctx = createMockCtx();

    // showWatermark: false
    renderFrame(ctx, 0, 90, makeOptions({ showWatermark: false }));
    let calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
    let fillTextWatermark = calls.find(
      (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio'
    );
    expect(fillTextWatermark).toBeUndefined();

    // showWatermark omitted (default)
    const ctx2 = createMockCtx();
    renderFrame(ctx2, 0, 90, makeOptions());
    calls = (ctx2 as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
    fillTextWatermark = calls.find(
      (c) => c.method === 'fillText' && c.args[0] === 'Ordio by Kaine Studio'
    );
    expect(fillTextWatermark).toBeUndefined();
  });
});
