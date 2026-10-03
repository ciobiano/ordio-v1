import { describe, it, expect } from 'vitest';
import { onePerWindow } from '../../../../packages/convex/convex/episodes';

const words = [{ text: 'hi', start: 0, end: 1 }];

describe('onePerWindow (episodes.resume)', () => {
  /* A window uploaded twice — once by a run that was dropped mid-chunk, once
     by the run that resumed it — must merge once, or every Word doubles. */
  it('keeps one chunk per window, preferring the transcribed copy', () => {
    const kept = onePerWindow([
      { startSec: 600, durationSec: 598, words: null },
      { startSec: 0, durationSec: 600, words },
      { startSec: 600.1, durationSec: 598, words },
    ]);
    expect(kept).toEqual([
      { startSec: 0, durationSec: 600, words },
      { startSec: 600.1, durationSec: 598, words },
    ]);
  });

  it('keeps the first copy when neither was transcribed', () => {
    const kept = onePerWindow([
      { startSec: 600, durationSec: 598, words: null },
      { startSec: 600.2, durationSec: 598, words: null },
    ]);
    expect(kept).toHaveLength(1);
  });

  it('leaves distinct windows alone, in order', () => {
    const kept = onePerWindow([
      { startSec: 1200, durationSec: 600, words },
      { startSec: 0, durationSec: 600, words },
    ]);
    expect(kept.map((c) => c.startSec)).toEqual([0, 1200]);
  });
});
