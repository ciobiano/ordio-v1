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
  textAlign: 'center',
  verticalAlign: 'auto',
  backgroundScrim: 'flat',
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

  it('renders the watermark slug top-right in a monospace face', () => {
    const ctx = createMockCtx();
    renderFrame(ctx, 0, 90, makeOptions({ showWatermark: true }));

    const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
      .__calls;

    // Tracking is non-zero, so drawSpacedText emits one fillText per glyph.
    // Reassembling them is what actually proves the slug rendered.
    const glyphs = calls.filter((c) => c.method === 'fillText' && String(c.args[0]).length === 1);
    const drawn = glyphs.map((c) => String(c.args[0])).join('');
    const at = drawn.indexOf('ordio.space/create');
    expect(at).toBeGreaterThanOrEqual(0);

    const fontSet = calls.find(
      (c) => c.method === 'set:font' && String(c.args[0]).includes('monospace')
    );
    expect(fontSet).toBeDefined();

    // Only the slug's own glyphs. Captions are drawn per-character too, so
    // filtering on "single character" alone sweeps them in and the position
    // assertions below become meaningless.
    const slugGlyphs = glyphs.slice(at, at + 'ordio.space/create'.length);
    const xs = slugGlyphs.map((c) => Number(c.args[1]));
    const ys = slugGlyphs.map((c) => Number(c.args[2]));
    expect(Math.min(...xs)).toBeGreaterThan(1080 / 2);
    expect(Math.max(...ys)).toBeLessThan(1920 / 8);
  });

  it('blinks the caret on the half second rather than fading it', () => {
    // renderFrame takes a frame index, not seconds: currentTime = frame / FPS.
    // At 30fps the caret is on for frames 0-14 of each second and off for
    // 15-29, so frame 20 lands in the off half.
    const countCarets = (frame: number) => {
      const ctx = createMockCtx();
      renderFrame(ctx, frame, 90, makeOptions({ showWatermark: true }));
      const calls = (ctx as unknown as { __calls: Array<{ method: string; args: unknown[] }> })
        .__calls;
      // Neither shape nor corner identifies the caret on their own: waveform
      // bars are narrow, tall, and can reach the top-right. Its colour is the
      // one thing nothing else in the frame uses.
      return calls.filter(
        (c) => c.method === 'set:fillStyle' && String(c.args[0]).toUpperCase() === '#D81E0B'
      ).length;
    };

    expect(countCarets(0)).toBeGreaterThan(0); // 0.00s — on
    expect(countCarets(20)).toBe(0); // 0.67s — off, with no intermediate state
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
    const slugFrom = (c: Array<{ method: string; args: unknown[] }>) =>
      c
        .filter((x) => x.method === 'fillText' && String(x.args[0]).length === 1)
        .map((x) => String(x.args[0]))
        .join('');

    expect(slugFrom(calls)).not.toContain('ordio.space');

    // showWatermark omitted (default)
    const ctx2 = createMockCtx();
    renderFrame(ctx2, 0, 90, makeOptions());
    calls = (ctx2 as unknown as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
    expect(slugFrom(calls)).not.toContain('ordio.space');
  });
});
