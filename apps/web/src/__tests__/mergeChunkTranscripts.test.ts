import { describe, it, expect } from 'vitest';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';

describe('mergeChunkTranscripts', () => {
  it('offsets words by chunk start', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 0, words: [{ text: 'hello', start: 0.5, end: 0.9 }] },
      { startSec: 600, words: [{ text: 'world', start: 1.0, end: 1.4 }] },
    ]);
    expect(merged).toEqual([
      { text: 'hello', start: 0.5, end: 0.9 },
      { text: 'world', start: 601.0, end: 601.4 },
    ]);
  });

  it('clamps seam overlaps to keep starts monotonic', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 0, words: [{ text: 'a', start: 599.8, end: 600.2 }] },
      { startSec: 600, words: [{ text: 'b', start: -0.5, end: 0.1 }] }, // would be 599.5
    ]);
    expect(merged[1]!.start).toBeGreaterThanOrEqual(merged[0]!.start);
    expect(merged[1]!.end).toBeGreaterThanOrEqual(merged[1]!.start);
  });

  it('sorts out-of-order chunks', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 600, words: [{ text: 'later', start: 0, end: 1 }] },
      { startSec: 0, words: [{ text: 'first', start: 0, end: 1 }] },
    ]);
    expect(merged.map((w) => w.text)).toEqual(['first', 'later']);
  });
});
