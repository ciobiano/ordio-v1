import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { concatAudioBuffers } from '@/lib/decodeMediaToAudioBuffer';

/** setup.ts stubs AudioContext without createBuffer; use a minimal real stub for these tests. */
class DecodeTestAudioContext {
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer {
    return new AudioBuffer({ length, numberOfChannels, sampleRate });
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

describe('concatAudioBuffers', () => {
  const savedCtx = globalThis.AudioContext;

  beforeAll(() => {
    globalThis.AudioContext = DecodeTestAudioContext as unknown as typeof AudioContext;
  });

  afterAll(() => {
    globalThis.AudioContext = savedCtx;
  });

  it('returns the same buffer when only one chunk', () => {
    const ctx = new AudioContext();
    const a = ctx.createBuffer(2, 100, 48_000);
    const out = concatAudioBuffers([a]);
    expect(out).toBe(a);
    void ctx.close();
  });

  it('concatenates sequential buffers in channel order', () => {
    const ctx = new AudioContext();
    const a = ctx.createBuffer(1, 40, 44_100);
    const b = ctx.createBuffer(1, 60, 44_100);
    a.getChannelData(0).fill(0.25);
    b.getChannelData(0).fill(0.5);
    const merged = concatAudioBuffers([a, b]);
    expect(merged.length).toBe(100);
    expect(merged.numberOfChannels).toBe(1);
    expect(merged.sampleRate).toBe(44_100);
    expect(merged.getChannelData(0)[39]).toBeCloseTo(0.25);
    expect(merged.getChannelData(0)[40]).toBeCloseTo(0.5);
    void ctx.close();
  });

  it('throws on empty input', () => {
    expect(() => concatAudioBuffers([])).toThrow(/no buffers/);
  });
});
