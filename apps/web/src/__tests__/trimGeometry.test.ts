/**
 * What a trim keeps, and where it puts it.
 *
 * These guard the property that matters and is easy to lose: the audio and the
 * transcript have to move by the *same* amount. Drift here is a few
 * milliseconds on one cut and a caption a word behind the voice after six, at
 * which point the cause is nowhere near the symptom.
 */

import { describe, it, expect } from 'vitest';
import type { Word } from '@Ordio/shared/schemas';
import {
  keptSampleRanges,
  shiftTranscript,
  trimChangesAnything,
  type TrimPlan,
} from '@/lib/audio/trimGeometry';
import { deskTrimPlan } from '@/lib/desktop/useDeskTrimCommit';

const RATE = 100; // 100 samples per second keeps the arithmetic readable.

const plan = (over: Partial<TrimPlan> = {}): TrimPlan => ({
  startTime: 0,
  endTime: 10,
  deletedRanges: [],
  ...over,
});

const words = (...spans: [string, number, number][]): Word[] =>
  spans.map(([text, start, end]) => ({ text, start, end }));

describe('kept ranges', () => {
  it('is the whole clip when nothing is trimmed', () => {
    expect(keptSampleRanges(plan(), RATE)).toEqual([{ start: 0, end: 1000 }]);
  });

  it('drops the head and the tail', () => {
    expect(keptSampleRanges(plan({ startTime: 2, endTime: 8 }), RATE)).toEqual([
      { start: 200, end: 800 },
    ]);
  });

  it('splits around an interior cut', () => {
    expect(
      keptSampleRanges(plan({ deletedRanges: [{ start: 4, end: 6 }] }), RATE)
    ).toEqual([
      { start: 0, end: 400 },
      { start: 600, end: 1000 },
    ]);
  });

  /* Overlapping cuts must collapse. Letting the cursor move backwards would
     emit the overlap twice and lengthen the clip by trimming it. */
  it('collapses overlapping cuts instead of duplicating audio', () => {
    const ranges = keptSampleRanges(
      plan({ deletedRanges: [{ start: 3, end: 6 }, { start: 4, end: 5 }] }),
      RATE
    );
    const total = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
    expect(total).toBe(700);
  });

  it('ignores cuts that fall outside the head/tail window', () => {
    expect(
      keptSampleRanges(
        plan({ startTime: 3, endTime: 7, deletedRanges: [{ start: 0, end: 1 }, { start: 9, end: 10 }] }),
        RATE
      )
    ).toEqual([{ start: 300, end: 700 }]);
  });
});

describe('transcript after the cut', () => {
  it('rebases against the head trim', () => {
    const shifted = shiftTranscript(plan({ startTime: 2 }), words(['a', 3, 4]));
    expect(shifted).toEqual([{ text: 'a', start: 1, end: 2 }]);
  });

  it('drops words outside the window', () => {
    const shifted = shiftTranscript(
      plan({ startTime: 2, endTime: 8 }),
      words(['before', 0, 1], ['inside', 4, 5], ['after', 9, 10])
    );
    expect(shifted.map((w) => w.text)).toEqual(['inside']);
  });

  /* A word the cut removed from the audio has to leave the transcript with
     it, or the captions announce a word that is no longer spoken. */
  it('drops a word that an interior cut removed', () => {
    const shifted = shiftTranscript(
      plan({ deletedRanges: [{ start: 2, end: 3 }] }),
      words(['keep', 0, 1], ['gone', 2, 3], ['keep2', 4, 5])
    );
    expect(shifted.map((w) => w.text)).toEqual(['keep', 'keep2']);
  });

  it('pulls later words back by the cut in front of them', () => {
    const shifted = shiftTranscript(
      plan({ deletedRanges: [{ start: 1, end: 3 }] }),
      words(['first', 0, 1], ['later', 4, 5])
    );
    expect(shifted[1].start).toBe(2);
    expect(shifted[1].end).toBe(3);
  });

  /* A cut that has not finished before the word starts is still in front of
     it on the timeline, so it must not move the word. */
  it('does not shift a word by a cut that overlaps its tail', () => {
    const shifted = shiftTranscript(
      plan({ deletedRanges: [{ start: 6.5, end: 8 }] }),
      words(['overlapped', 4, 7])
    );
    expect(shifted[0].start).toBe(4);
  });

  /* Whereas a cut that swallows the middle of a word takes the word: the
     audio for it is gone, so a caption for it would be a claim about silence. */
  it('removes a word whose middle the cut swallowed', () => {
    const shifted = shiftTranscript(
      plan({ deletedRanges: [{ start: 4.5, end: 6 }] }),
      words(['swallowed', 4, 7])
    );
    expect(shifted).toEqual([]);
  });
});

describe('audio and transcript stay in step', () => {
  /* The property the whole module exists for: after a cut, the surviving
     audio and the surviving words describe the same length of time. */
  it('shortens both by the same amount', () => {
    const p = plan({ startTime: 1, endTime: 9, deletedRanges: [{ start: 4, end: 5 }] });
    const keptSamples = keptSampleRanges(p, RATE).reduce(
      (sum, r) => sum + (r.end - r.start),
      0
    );
    const shifted = shiftTranscript(p, words(['a', 1, 2], ['b', 7, 8]));
    expect(keptSamples / RATE).toBe(7);
    /* The last word ends one second before the new end of the clip. */
    expect(shifted[shifted.length - 1].end).toBe(6);
  });
});

describe('whether a plan does anything', () => {
  it('is false for an untouched clip', () => {
    expect(trimChangesAnything(plan(), 10)).toBe(false);
  });

  it('is true for a head trim, a tail trim, or a cut', () => {
    expect(trimChangesAnything(plan({ startTime: 1 }), 10)).toBe(true);
    expect(trimChangesAnything(plan({ endTime: 9 }), 10)).toBe(true);
    expect(trimChangesAnything(plan({ deletedRanges: [{ start: 2, end: 3 }] }), 10)).toBe(true);
  });
});

describe('the desk handles, as a plan', () => {
  const pauses = [
    { at: 3, len: 1 },
    { at: 6, len: 2 },
  ];

  /* The desk counts the tail inwards from the end; the geometry works in
     absolute time. Getting this backwards trims the wrong end. */
  it('resolves the tail handle against the duration', () => {
    const p = deskTrimPlan({ trimIn: 1, trimOut: 2, cutPauses: [] }, 10, pauses);
    expect(p.startTime).toBe(1);
    expect(p.endTime).toBe(8);
  });

  it('gives a cut pause its length back from the detected list', () => {
    const p = deskTrimPlan({ trimIn: 0, trimOut: 0, cutPauses: [6] }, 10, pauses);
    expect(p.deletedRanges).toEqual([{ start: 6, end: 8 }]);
  });

  /* A pause can stop being detected when the transcript changes; a stale id
     must not become a zero-length cut or throw. */
  it('ignores a cut pause that is no longer detected', () => {
    const p = deskTrimPlan({ trimIn: 0, trimOut: 0, cutPauses: [99] }, 10, pauses);
    expect(p.deletedRanges).toEqual([]);
  });

  it('never lets the handles cross', () => {
    const p = deskTrimPlan({ trimIn: 8, trimOut: 8, cutPauses: [] }, 10, pauses);
    expect(p.endTime).toBeGreaterThanOrEqual(p.startTime);
  });
});
