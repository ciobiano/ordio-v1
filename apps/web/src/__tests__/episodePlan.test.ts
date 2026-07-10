import { describe, it, expect } from 'vitest';
import {
  planChunkWindows,
  createEnergyAccumulator,
  isSparseTranscript,
  OPUS_CHUNK_SEC,
} from '@/lib/media/episodePlan';

describe('planChunkWindows', () => {
  it('splits a 25-min episode into 600s windows with a short tail', () => {
    expect(planChunkWindows(1500, OPUS_CHUNK_SEC)).toEqual([
      { start: 0, end: 600 },
      { start: 600, end: 1200 },
      { start: 1200, end: 1500 },
    ]);
  });

  it('returns one window when episode is shorter than a chunk', () => {
    expect(planChunkWindows(120, 600)).toEqual([{ start: 0, end: 120 }]);
  });

  it('returns [] for zero/negative duration', () => {
    expect(planChunkWindows(0, 600)).toEqual([]);
  });
});

describe('isSparseTranscript', () => {
  it('flags under 30 words/min', () => {
    expect(isSparseTranscript(29, 60)).toBe(true);
    expect(isSparseTranscript(31, 60)).toBe(false);
  });
});

describe('createEnergyAccumulator', () => {
  it('produces normalized per-second RMS with loud second > quiet second', () => {
    const acc = createEnergyAccumulator(2);
    const rate = 100;
    const loud = new Float32Array(rate).fill(0.8);
    const quiet = new Float32Array(rate).fill(0.2);
    acc.add(loud, 0, rate);
    acc.add(quiet, 1, rate);
    const energy = acc.finish();
    expect(energy).toHaveLength(2);
    expect(energy[0]).toBeCloseTo(1, 5);
    expect(energy[1]!).toBeLessThan(energy[0]!);
  });

  it('yields zeros for silence', () => {
    const acc = createEnergyAccumulator(1);
    acc.add(new Float32Array(10), 0, 10);
    expect(acc.finish()).toEqual([0]);
  });
});
