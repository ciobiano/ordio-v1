import { describe, it, expect } from 'vitest';
import {
  nextWindowEnd,
  findQuietCut,
  createEnergyAccumulator,
  isSparseTranscript,
  worstCaseChunkBytes,
  CHUNK_SEC,
  CHUNK_BITRATE_BPS,
  CUT_SEARCH_SEC,
  MAX_EPISODE_SEC,
  TAIL_ABSORB_SEC,
  UPLOAD_BODY_LIMIT_BYTES,
} from '@Ordio/engine/media/episodePlan';

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

/**
 * Requests a whole Episode costs when every pause-aligned cut lands at the
 * earliest point it may — CUT_SEARCH_SEC before the nominal end.
 */
function worstCaseRequestCount(durationSec: number): number {
  let start = 0;
  let requests = 0;
  while (start < durationSec) {
    const { end, isLast } = nextWindowEnd(start, durationSec, CHUNK_SEC);
    requests++;
    start = isLast ? end : end - CUT_SEARCH_SEC;
  }
  return requests;
}

describe('chunk plan against the deployment limits', () => {
  /* Vercel refuses a body over 4.5 MB before the route runs. A fifth of the
     limit is held back for container framing, VBR overshoot and the multipart
     envelope, none of which the bitrate figure counts. */
  const BUDGET_BYTES = UPLOAD_BODY_LIMIT_BYTES * 0.8;

  it.each(Object.entries(CHUNK_BITRATE_BPS))(
    'keeps the largest %s chunk inside the upload body limit',
    (_strategy, bitrateBps) => {
      expect(worstCaseChunkBytes(bitrateBps)).toBeLessThan(BUDGET_BYTES);
    }
  );

  it('sizes the largest chunk as a full chunk plus the absorbed tail', () => {
    // 690s at 32 kbps = 4,000 bytes a second.
    expect(worstCaseChunkBytes(32_000)).toBe((CHUNK_SEC + TAIL_ABSORB_SEC) * 4_000);
  });

  // Why there is no WAV fallback: 16kHz 16-bit mono PCM cannot fit a chunk.
  it('rules out uncompressed PCM at this chunk length', () => {
    expect(worstCaseChunkBytes(16_000 * 16)).toBeGreaterThan(UPLOAD_BODY_LIMIT_BYTES);
  });

  /* /api/transcribe allows 15 requests an hour. A 90-minute Episode must leave
     room under that for retries, whichever codec the browser fell back to. */
  it('fits a 90-minute Episode in ten requests even with every cut early', () => {
    expect(worstCaseRequestCount(MAX_EPISODE_SEC)).toBeLessThanOrEqual(10);
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
