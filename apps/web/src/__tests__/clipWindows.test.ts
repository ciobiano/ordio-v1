import { describe, it, expect } from 'vitest';
import { validateCandidates } from '@/lib/clips/validateCandidates';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';
import { windowTranscript } from '@/components/mobile/clips/ClipPickerSheet';

const mk = (start: number, end: number) => ({ start, end, hookText: 'h', rationale: 'r' });

describe('validateCandidates', () => {
  it('keeps valid 30–60s in-bounds windows, max 3', () => {
    const raw = [mk(0, 45), mk(100, 150), mk(300, 340), mk(500, 550)];
    expect(validateCandidates(raw, 3600)).toHaveLength(3);
  });

  it('drops windows out of bounds or with bad length', () => {
    const raw = [mk(0, 20), mk(0, 90), mk(3590, 3650), mk(60, 100)];
    expect(validateCandidates(raw, 3600)).toEqual([mk(60, 100)]);
  });

  it('drops overlapping windows, keeping the earlier one', () => {
    const raw = [mk(0, 45), mk(30, 75)];
    expect(validateCandidates(raw, 3600)).toEqual([mk(0, 45)]);
  });

  it('returns [] for garbage input', () => {
    expect(validateCandidates('nope', 3600)).toEqual([]);
    expect(validateCandidates([{ start: 'x' }], 3600)).toEqual([]);
  });

  it('1–2 candidates is a valid result (never forces 3)', () => {
    expect(validateCandidates([mk(0, 45)], 3600)).toHaveLength(1);
  });
});

describe('fallbackWindows', () => {
  it('returns the highest-energy non-overlapping windows first', () => {
    const energy = new Array(200).fill(0.1);
    for (let s = 100; s < 145; s++) energy[s] = 1.0;
    const wins = fallbackWindows(energy, 200);
    expect(wins.length).toBeGreaterThan(0);
    expect(wins[0]!.start).toBeGreaterThanOrEqual(90);
    expect(wins[0]!.start).toBeLessThanOrEqual(110);
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i]!.start >= wins[i - 1]!.end || wins[i]!.end <= wins[i - 1]!.start).toBe(true);
    }
  });

  it('returns [] when episode is shorter than a window', () => {
    expect(fallbackWindows([1, 1, 1], 30)).toEqual([]);
  });
});

describe('windowTranscript', () => {
  it('keeps only in-window words, re-based to clip time', () => {
    const words = [
      { text: 'before', start: 10, end: 11 },
      { text: 'inside', start: 61, end: 62 },
      { text: 'edge', start: 89, end: 91 }, // ends after window — excluded
    ];
    expect(windowTranscript(words, 60, 90)).toEqual([
      { text: 'inside', start: 1, end: 2 },
    ]);
  });
});
