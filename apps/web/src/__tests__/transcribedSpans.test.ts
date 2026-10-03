import { describe, it, expect } from 'vitest';
import { coversWhole, insideSpans, maskToSpans, transcribedSpans } from '@/lib/clips/transcribedSpans';

describe('transcribedSpans', () => {
  it('joins chunks that meet at a seam into one span, whatever order they finished in', () => {
    const chunks = [
      { startSec: 597.3, durationSec: 600.1 },
      { startSec: 0, durationSec: 597.3 },
    ];
    expect(transcribedSpans(chunks)).toEqual([{ start: 0, end: 1197.4 }]);
  });

  it('leaves a hole where a chunk failed', () => {
    const chunks = [
      { startSec: 0, durationSec: 600 },
      { startSec: 1200, durationSec: 600 }, // 600–1200 failed
    ];
    expect(transcribedSpans(chunks)).toEqual([
      { start: 0, end: 600 },
      { start: 1200, end: 1800 },
    ]);
  });
});

describe('insideSpans', () => {
  const spans = [
    { start: 0, end: 600 },
    { start: 1200, end: 1800 },
  ];

  it('keeps a window inside either island', () => {
    expect(insideSpans({ start: 100, end: 145 }, spans)).toBe(true);
    expect(insideSpans({ start: 1300, end: 1345 }, spans)).toBe(true);
  });

  it('rejects a window that reaches into the hole', () => {
    expect(insideSpans({ start: 580, end: 625 }, spans)).toBe(false);
    expect(insideSpans({ start: 700, end: 745 }, spans)).toBe(false);
  });
});

describe('maskToSpans', () => {
  it('zeroes the energy of seconds with no transcript', () => {
    expect(maskToSpans([1, 1, 1, 1, 1], [{ start: 1, end: 3 }])).toEqual([0, 1, 1, 0, 0]);
  });
});

describe('coversWhole', () => {
  it('is true for one span from the start to the end', () => {
    expect(coversWhole([{ start: 0, end: 1799.8 }], 1800)).toBe(true);
  });

  it('is false while a chunk is missing', () => {
    expect(coversWhole([{ start: 0, end: 600 }, { start: 1200, end: 1800 }], 1800)).toBe(false);
  });

  it('is false when the end was never transcribed', () => {
    expect(coversWhole([{ start: 0, end: 1200 }], 1800)).toBe(false);
  });

  it('is false with nothing transcribed', () => {
    expect(coversWhole([], 1800)).toBe(false);
  });
});
