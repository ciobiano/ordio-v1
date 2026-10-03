import { describe, it, expect } from 'vitest';
import {
  nextWindowEnd,
  findQuietCut,
  createEnergyAccumulator,
  isSparseTranscript,
  resumeStep,
  CHUNK_SEC,
  MAX_EPISODE_SEC,
  TAIL_ABSORB_SEC,
} from '@Ordio/engine/media/episodePlan';
import { WHISPER_MAX_BYTES, whisperWavBytes } from '@Ordio/engine/media/whisperAudio';

describe('chunk size', () => {
  /* Chunks are lossless 16kHz WAV and reach Whisper through storage, so the
     only ceiling is Whisper's 25MB. The biggest chunk is a full window with
     the tail folded in. */
  it('keeps the largest possible chunk inside the 25MB Whisper limit', () => {
    expect(whisperWavBytes(CHUNK_SEC + TAIL_ABSORB_SEC)).toBeLessThan(WHISPER_MAX_BYTES);
  });

  it('reads a 90-minute Episode in at most 10 requests, inside the 15-an-hour limit', () => {
    // Pause-aligned cuts land up to CUT_SEARCH_SEC early, so allow one extra.
    expect(Math.ceil(MAX_EPISODE_SEC / CHUNK_SEC) + 1).toBeLessThanOrEqual(10);
  });
});

describe('nextWindowEnd', () => {
  it('ends a window one chunk on when plenty of episode remains', () => {
    expect(nextWindowEnd(0, 1500, CHUNK_SEC)).toEqual({ end: 600, isLast: false });
  });

  it('folds a short leftover into the window before it', () => {
    // 600 + 60s left over: one 660s request, not a 600s one and a 60s one.
    expect(nextWindowEnd(0, 660, CHUNK_SEC)).toEqual({ end: 660, isLast: true });
  });

  it('keeps a leftover of a full TAIL_ABSORB_SEC as its own window', () => {
    expect(nextWindowEnd(0, 600 + TAIL_ABSORB_SEC, CHUNK_SEC)).toEqual({ end: 600, isLast: false });
  });

  it('treats an episode shorter than a chunk as one last window', () => {
    expect(nextWindowEnd(0, 120, CHUNK_SEC)).toEqual({ end: 120, isLast: true });
  });

  it('still reaches the end when starts drift off the chunk grid', () => {
    // Pause-aligned cuts land a few seconds early, so starts are never round.
    expect(nextWindowEnd(1187.3, 1800, CHUNK_SEC)).toEqual({ end: 1800, isLast: true });
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

describe('resumeStep', () => {
  const saved = [
    { startSec: 0, durationSec: 597.3 },
    { startSec: 597.3, durationSec: 601.2 },
    { startSec: 1800, durationSec: 590 },
  ];

  it('jumps past a saved chunk without decoding it', () => {
    expect(resumeStep(0, saved)).toEqual({ skipTo: 597.3 });
    expect(resumeStep(597.3, saved)).toEqual({ skipTo: 1198.5 });
  });

  it('allows for a decoded packet of drift at a saved edge', () => {
    expect(resumeStep(0.02, saved)).toEqual({ skipTo: 597.3 });
  });

  /* Another browser's decoder can cut elsewhere. A position inside a saved
     chunk still skips to its end, rather than transcribing the rest of it. */
  it('skips the rest of a saved chunk it lands inside', () => {
    expect(resumeStep(300, saved)).toEqual({ skipTo: 597.3 });
  });

  it('stops a new window exactly where the next saved chunk begins', () => {
    expect(resumeStep(1198.5, saved)).toEqual({ stopAt: 1800 });
  });

  it('has nowhere to stop after the last saved chunk', () => {
    expect(resumeStep(2390, saved)).toEqual({ stopAt: null });
  });

  /* A skip must always move forward, or the decoder loop would spin. A saved
     chunk shorter than the drift allowance is simply read again. */
  it('reads over a saved chunk too short to skip, rather than stalling on it', () => {
    expect(resumeStep(10, [{ startSec: 10, durationSec: 0.2 }])).toEqual({ stopAt: null });
  });
});
