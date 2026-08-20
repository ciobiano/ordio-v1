import { describe, it, expect } from 'vitest';
import {
  MIN_BED_SEC,
  bedDuration,
  bedFromDrop,
  bedSpan,
  moveBed,
  timeAtX,
  trimBedEnd,
  trimBedStart,
  type BedClip,
} from '@/lib/audio/bedGeometry';

/** A 30s sound dropped at 10s, untrimmed. */
const bed = (over: Partial<BedClip> = {}): BedClip => ({
  name: 'riser.wav',
  url: 'blob:x',
  sourceDuration: 30,
  startAt: 10,
  trimIn: 0,
  trimOut: 0,
  ...over,
});

const rect = (left: number, width: number) => ({ left, width }) as DOMRect;

describe('dropping a sound', () => {
  it('lands where it was let go', () => {
    const b = bedFromDrop('riser.wav', 'blob:x', 30, 12.5);
    expect(b.startAt).toBe(12.5);
    expect(bedDuration(b)).toBe(30);
  });

  it('cannot land before the start of the session', () => {
    expect(bedFromDrop('r.wav', 'blob:x', 30, -4).startAt).toBe(0);
  });

  it('reads a drop position from the pointer', () => {
    expect(timeAtX(150, rect(100, 200), 60)).toBe(15);
  });

  it('clamps a drop past either edge of the track', () => {
    expect(timeAtX(40, rect(100, 200), 60)).toBe(0);
    expect(timeAtX(9999, rect(100, 200), 60)).toBe(60);
  });

  it('does not divide by zero before a clip is loaded', () => {
    expect(timeAtX(150, rect(100, 200), 0)).toBe(0);
    expect(timeAtX(150, rect(100, 0), 60)).toBe(0);
  });
});

describe('moving a bed', () => {
  it('keeps its trims', () => {
    const moved = moveBed(bed({ trimIn: 3, trimOut: 4 }), 20);
    expect(moved.startAt).toBe(20);
    expect(moved.trimIn).toBe(3);
    expect(moved.trimOut).toBe(4);
    expect(bedDuration(moved)).toBe(23);
  });

  it('stops at the start of the session', () => {
    expect(moveBed(bed(), -5).startAt).toBe(0);
  });

  /* An outro sting past the end of the voice is a legal arrangement — the
     export is the voice's length, so it simply is not heard. */
  it('may be placed past the end of the voice', () => {
    expect(moveBed(bed(), 500).startAt).toBe(500);
  });
});

describe('trimming from the head', () => {
  it('moves the edge without moving the audio under it', () => {
    const t = trimBedStart(bed(), 14);
    expect(t.startAt).toBe(14);
    expect(t.trimIn).toBe(4);
    /* The sound that was at 14s is still at 14s: 4s came off the front and
       the block start moved forward by the same 4s. */
    expect(bedSpan(t).end).toBe(bedSpan(bed()).end);
  });

  it('cannot be dragged past the source running out', () => {
    /* 5s already trimmed, so the earliest reachable point is startAt - 5. */
    const t = trimBedStart(bed({ startAt: 10, trimIn: 5 }), 0);
    expect(t.startAt).toBe(5);
    expect(t.trimIn).toBe(0);
  });

  it('leaves a grabbable sliver rather than collapsing', () => {
    const t = trimBedStart(bed(), 999);
    expect(bedDuration(t)).toBeCloseTo(MIN_BED_SEC, 5);
    expect(bedDuration(t)).toBeGreaterThan(0);
  });

  it('never starts before the session', () => {
    const t = trimBedStart(bed({ startAt: 2, trimIn: 10 }), -50);
    expect(t.startAt).toBeGreaterThanOrEqual(0);
  });
});

describe('trimming from the tail', () => {
  it('shortens the block without moving its start', () => {
    const t = trimBedEnd(bed(), 25);
    expect(t.startAt).toBe(10);
    expect(bedDuration(t)).toBe(15);
    expect(t.trimOut).toBe(15);
  });

  it('cannot be dragged past the source running out', () => {
    const t = trimBedEnd(bed(), 999);
    expect(t.trimOut).toBe(0);
    expect(bedDuration(t)).toBe(30);
  });

  it('leaves a grabbable sliver rather than collapsing', () => {
    const t = trimBedEnd(bed(), -999);
    expect(bedDuration(t)).toBeCloseTo(MIN_BED_SEC, 5);
  });

  it('respects a head trim already taken', () => {
    /* 6s off the front leaves 24s of source, so the tail can reach 10+24. */
    const t = trimBedEnd(bed({ trimIn: 6 }), 999);
    expect(bedSpan(t).end).toBe(34);
    expect(t.trimOut).toBe(0);
  });
});

describe('the two handles together', () => {
  it('survive being dragged in from both sides', () => {
    let b = bed();
    b = trimBedStart(b, 18);
    b = trimBedEnd(b, 24);
    expect(b.trimIn).toBe(8);
    expect(bedDuration(b)).toBeCloseTo(6, 5);
    expect(b.trimIn + b.trimOut).toBeCloseTo(24, 5);
    expect(b.trimIn + b.trimOut).toBeLessThan(b.sourceDuration);
  });

  it('never produce a negative duration under any drag order', () => {
    const orders: ((b: BedClip) => BedClip)[][] = [
      [(b) => trimBedStart(b, 999), (b) => trimBedEnd(b, -999)],
      [(b) => trimBedEnd(b, -999), (b) => trimBedStart(b, 999)],
      [(b) => trimBedStart(b, 999), (b) => moveBed(b, 0), (b) => trimBedEnd(b, -999)],
    ];
    for (const order of orders) {
      const out = order.reduce((b, step) => step(b), bed());
      expect(bedDuration(out)).toBeGreaterThan(0);
      expect(out.trimIn).toBeGreaterThanOrEqual(0);
      expect(out.trimOut).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ── Ducking ─────────────────────────────────────────────────────────
   The music gain follows the transcript, so the spans it follows have to be
   right. A gap too short to lift the music into is the case that matters:
   raising the bed for the 80ms between two words in a sentence sounds like a
   fault, not like mixing. */

import { speechSpans } from '@/lib/audio/mixBed';

const w = (start: number, end: number) => ({ text: 'x', start, end });

describe('speech spans for ducking', () => {
  it('is empty with no transcript', () => {
    expect(speechSpans([])).toEqual([]);
  });

  it('merges words separated by less than the gap', () => {
    expect(speechSpans([w(0, 1), w(1.1, 2), w(2.05, 3)])).toEqual([{ start: 0, end: 3 }]);
  });

  it('splits on a real pause', () => {
    expect(speechSpans([w(0, 1), w(5, 6)])).toEqual([
      { start: 0, end: 1 },
      { start: 5, end: 6 },
    ]);
  });

  it('treats a gap exactly at the threshold as a pause', () => {
    expect(speechSpans([w(0, 1), w(1.4, 2)], 0.4)).toHaveLength(2);
    expect(speechSpans([w(0, 1), w(1.39, 2)], 0.4)).toHaveLength(1);
  });

  it('survives words that overlap each other', () => {
    /* Whisper occasionally emits these; a span must never run backwards. */
    const spans = speechSpans([w(0, 2), w(1, 1.5), w(1.2, 3)]);
    expect(spans).toEqual([{ start: 0, end: 3 }]);
    for (const s of spans) expect(s.end).toBeGreaterThan(s.start);
  });
});
