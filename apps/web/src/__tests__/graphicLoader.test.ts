import { describe, it, expect, vi, beforeEach } from 'vitest';

// Note: graphicLoader uses a module-level cache. Use vi.resetModules() to clear between tests.

describe('graphicLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('loadGraphic resolves with an HTMLImageElement for graphic-frame1', async () => {
    vi.stubGlobal('Image', function (this: { src: string; onload: (() => void) | null; onerror: (() => void) | null; naturalWidth: number; naturalHeight: number }) {
      this.src = '';
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 340;
      this.naturalHeight = 355;
      setTimeout(() => this.onload?.(), 0);
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame1');
    expect(img).toBeDefined();
    expect(img.src).toContain('frame1.svg');
  });

  it('loadGraphic resolves for graphic-frame2', async () => {
    vi.stubGlobal('Image', function (this: { src: string; onload: (() => void) | null; onerror: (() => void) | null; naturalWidth: number; naturalHeight: number }) {
      this.src = '';
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 321;
      this.naturalHeight = 189;
      setTimeout(() => this.onload?.(), 0);
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    const img = await loadGraphic('graphic-frame2');
    expect(img.src).toContain('frame2.svg');
  });

  it('loadGraphic rejects on load error', async () => {
    vi.stubGlobal('Image', function (this: { src: string; onload: (() => void) | null; onerror: (() => void) | null }) {
      this.src = '';
      this.onload = null;
      this.onerror = null;
      setTimeout(() => this.onerror?.(), 0);
    });

    const { loadGraphic } = await import('@/lib/graphicLoader');
    await expect(loadGraphic('graphic-frame1')).rejects.toThrow('Failed to load graphic');
  });

  it('getGraphic returns null before any load', async () => {
    const { getGraphic } = await import('@/lib/graphicLoader');
    expect(getGraphic('graphic-frame1')).toBeNull();
  });
});
