import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('detectIngestStrategy', () => {
  beforeEach(() => vi.resetModules());

  it('returns opus when mediabunny reports Opus encodable', async () => {
    vi.doMock('mediabunny', () => ({ canEncodeAudio: vi.fn().mockResolvedValue(true) }));
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('opus');
  });

  it('returns wav when Opus is not encodable', async () => {
    vi.doMock('mediabunny', () => ({ canEncodeAudio: vi.fn().mockResolvedValue(false) }));
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('wav');
  });

  it('returns wav when mediabunny import fails', async () => {
    vi.doMock('mediabunny', () => {
      throw new Error('no webcodecs');
    });
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('wav');
  });
});
