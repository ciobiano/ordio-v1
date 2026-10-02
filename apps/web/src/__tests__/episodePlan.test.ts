import { describe, it, expect } from 'vitest';
import {
  planChunkWindows,
  createEnergyAccumulator,
  isSparseTranscript,
  worstCaseChunkBytes,
  CHUNK_SEC,
  CHUNK_BITRATE_BPS,
  MAX_EPISODE_SEC,
  UPLOAD_BODY_LIMIT_BYTES,
} from '@Ordio/engine/media/episodePlan';

describe('planChunkWindows', () => {
  it('splits a 25-min episode into 600s windows with a short tail', () => {
    expect(planChunkWindows(1500, CHUNK_SEC)).toEqual([
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

  it('sizes the largest chunk as one full window', () => {
    // 600s at 32 kbps = 4,000 bytes a second.
    expect(worstCaseChunkBytes(32_000)).toBe(CHUNK_SEC * 4_000);
  });

  // Why there is no WAV fallback: 16kHz 16-bit mono PCM cannot fit a chunk.
  it('rules out uncompressed PCM at this chunk length', () => {
    expect(worstCaseChunkBytes(16_000 * 16)).toBeGreaterThan(UPLOAD_BODY_LIMIT_BYTES);
  });

  /* /api/transcribe allows 15 requests an hour. A 90-minute Episode must leave
     room under that for retries, whichever codec the browser fell back to. */
  it('fits a 90-minute Episode in nine requests', () => {
    expect(planChunkWindows(MAX_EPISODE_SEC, CHUNK_SEC)).toHaveLength(9);
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
