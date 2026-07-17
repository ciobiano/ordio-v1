import { describe, it, expect } from 'vitest';
import { checkRateLimit, consumeRateLimit } from '@/lib/liveTranscription/rateLimit';

const LIMIT = 3;
const WINDOW = 60_000;

describe('checkRateLimit', () => {
  it('allows requests under the limit and records them', () => {
    const r1 = checkRateLimit([], 1_000, LIMIT, WINDOW);
    expect(r1.allowed).toBe(true);
    expect(r1.timestamps).toEqual([1_000]);
  });

  it('denies once the window holds limit entries', () => {
    const full = [1_000, 2_000, 3_000];
    const r = checkRateLimit(full, 4_000, LIMIT, WINDOW);
    expect(r.allowed).toBe(false);
    expect(r.timestamps).toEqual(full);
  });

  it('expires old entries so capacity returns after the window', () => {
    const full = [1_000, 2_000, 3_000];
    const r = checkRateLimit(full, 1_000 + WINDOW + 1, LIMIT, WINDOW);
    expect(r.allowed).toBe(true);
    // Only 2_000/3_000 survive plus the new entry.
    expect(r.timestamps).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const input = [1_000];
    checkRateLimit(input, 2_000, LIMIT, WINDOW);
    expect(input).toEqual([1_000]);
  });
});

describe('consumeRateLimit', () => {
  it('tracks per-key state across calls', () => {
    const key = `user-${Math.random()}`;
    expect(consumeRateLimit(key, 2, WINDOW, 1_000)).toBe(true);
    expect(consumeRateLimit(key, 2, WINDOW, 2_000)).toBe(true);
    expect(consumeRateLimit(key, 2, WINDOW, 3_000)).toBe(false);
    expect(consumeRateLimit(`${key}-other`, 2, WINDOW, 3_000)).toBe(true);
  });
});
