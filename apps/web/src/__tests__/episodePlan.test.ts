import { describe, it, expect } from 'vitest';
import {
  nextWindowEnd,
  findQuietCut,
  createEnergyAccumulator,
  isSparseTranscript,
  OPUS_CHUNK_SEC,
  TAIL_ABSORB_SEC,
} from '@Ordio/engine/media/episodePlan';

describe('nextWindowEnd', () => {
  it('ends a window one chunk on when plenty of episode remains', () => {
    expect(nextWindowEnd(0, 1500, OPUS_CHUNK_SEC)).toEqual({ end: 600, isLast: false });
  });

  it('folds a short leftover into the window before it', () => {
    // 600 + 60s left over: one 660s request, not a 600s one and a 60s one.
    expect(nextWindowEnd(0, 660, OPUS_CHUNK_SEC)).toEqual({ end: 660, isLast: true });
  });

  it('keeps a leftover of a full TAIL_ABSORB_SEC as its own window', () => {
    expect(nextWindowEnd(0, 600 + TAIL_ABSORB_SEC, OPUS_CHUNK_SEC)).toEqual({ end: 600, isLast: false });
  });

  it('treats an episode shorter than a chunk as one last window', () => {
    expect(nextWindowEnd(0, 120, OPUS_CHUNK_SEC)).toEqual({ end: 120, isLast: true });
  });

  it('still reaches the end when starts drift off the chunk grid', () => {
    // Pause-aligned cuts land a few seconds early, so starts are never round.
    expect(nextWindowEnd(1187.3, 1800, OPUS_CHUNK_SEC)).toEqual({ end: 1800, isLast: true });
  });
});

describe('findQuietCut', () => {
  const RATE = 1000;
  const tone = (sec: number) => Float32Array.from({ length: sec * RATE }, (_, i) => Math.sin(i));

  it('cuts in the middle of a pause inside the search window', () => {
    const samples = tone(30);
    samples.fill(0, 22 * RATE, 23 * RATE); // a one-second pause at 22–23s
    const cut = findQuietCut(samples, RATE, 15);
    expect(cut).toBeGreaterThan(22);
    expect(cut).toBeLessThan(23);
  });

  it('ignores a pause before the search window', () => {
    const samples = tone(30);
    samples.fill(0, 5 * RATE, 6 * RATE); // quiet, but 25s from the end
    expect(findQuietCut(samples, RATE, 15)).toBeGreaterThanOrEqual(15);
  });

  it('prefers a real pause over a closure-length dip', () => {
    const samples = tone(30);
    samples.fill(0, 20 * RATE, 20 * RATE + 100); // 100ms — a stop consonant
    samples.fill(0, 26 * RATE, 26 * RATE + 400); // 400ms — a pause between words
    const cut = findQuietCut(samples, RATE, 15);
    expect(cut).toBeGreaterThan(26);
    expect(cut).toBeLessThan(26.4);
  });

  it('cuts near the nominal end when the level never drops', () => {
    expect(findQuietCut(new Float32Array(30 * RATE).fill(0.5), RATE, 15)).toBeGreaterThan(29.5);
  });

  it('returns the full length when there is too little audio to search', () => {
    expect(findQuietCut(new Float32Array(200), RATE, 15)).toBeCloseTo(0.2);
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
