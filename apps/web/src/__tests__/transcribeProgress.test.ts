/**
 * The transcription progress estimate.
 *
 * The properties that matter are not the exact numbers — it is an estimate —
 * but that it is monotonic, bounded, and never claims completion. A bar that
 * goes backwards or parks at 100% before the response arrives is worse than
 * no bar, which is what the 40-point hold it replaced amounted to.
 */

import { describe, it, expect } from 'vitest';
import {
  expectedTranscribeMs,
  transcribeFraction,
  transcribeProgressAt,
  TRANSCRIBE_OVERHEAD_MS,
} from '@/lib/audio/transcribeProgress';

describe('expected duration', () => {
  it('is the fixed overhead for audio of no length', () => {
    expect(expectedTranscribeMs(0)).toBe(TRANSCRIBE_OVERHEAD_MS);
  });

  it('grows with the length of the audio', () => {
    expect(expectedTranscribeMs(600)).toBeGreaterThan(expectedTranscribeMs(60));
  });

  it('treats nonsense input as no length rather than propagating NaN', () => {
    expect(expectedTranscribeMs(Number.NaN)).toBe(TRANSCRIBE_OVERHEAD_MS);
    expect(expectedTranscribeMs(-5)).toBe(TRANSCRIBE_OVERHEAD_MS);
  });
});

describe('the fraction elapsed', () => {
  it('starts at zero', () => {
    expect(transcribeFraction(0, 10_000)).toBe(0);
  });

  it('never reaches one, however long it runs', () => {
    expect(transcribeFraction(10_000_000, 10_000)).toBeLessThan(1);
  });

  it('is strictly increasing', () => {
    let previous = -1;
    for (let ms = 0; ms <= 120_000; ms += 500) {
      const value = transcribeFraction(ms, 20_000);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('is most of the way there once the estimate is doubled', () => {
    expect(transcribeFraction(40_000, 20_000)).toBeGreaterThan(0.8);
  });

  it('returns zero rather than dividing by an unusable estimate', () => {
    expect(transcribeFraction(5_000, 0)).toBe(0);
    expect(transcribeFraction(5_000, Number.NaN)).toBe(0);
  });
});

describe('progress across a step', () => {
  /* The step's span is on the 0–100 scale the rest of the pipeline uses.
     Reading these as fractions is what pinned the desk's bar at full width. */
  it('starts at the step and stays inside it', () => {
    expect(transcribeProgressAt(0, 20_000, 30, 84)).toBe(30);
    expect(transcribeProgressAt(10_000_000, 20_000, 30, 84)).toBeLessThan(84);
  });

  it('has moved appreciably by the time the estimate is up', () => {
    const at = transcribeProgressAt(20_000, 20_000, 30, 84);
    expect(at).toBeGreaterThan(60);
    expect(at).toBeLessThan(84);
  });
});
