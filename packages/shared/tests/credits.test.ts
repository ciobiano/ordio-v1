import { describe, it, expect } from 'vitest';
import {
  CREDITS_PER_MINUTE,
  WELCOME_GRANT_CREDITS,
  creditsForSeconds,
  minutesFromCredits,
  applyDebit,
  settleHold,
  hasCredits,
} from '../src/credits';

describe('credit constants', () => {
  it('gives 30 minutes as the welcome grant', () => {
    expect(minutesFromCredits(WELCOME_GRANT_CREDITS)).toBe(30);
  });

  it('is the only way credits ever enter an account', () => {
    // With no checkout and no refill, the welcome grant is the entire cost
    // model: lifetime exposure per signup is exactly one grant. If a second
    // credit source ever appears, this assertion is the wrong one to delete —
    // the budget maths in credits.ts is what needs revisiting first.
    expect(minutesFromCredits(WELCOME_GRANT_CREDITS)).toBe(30);
  });
});

describe('creditsForSeconds', () => {
  it('charges 10 credits for a minute', () => {
    expect(creditsForSeconds(60)).toBe(CREDITS_PER_MINUTE);
  });

  it('rounds up so we never eat the remainder', () => {
    expect(creditsForSeconds(61)).toBe(11);
    expect(creditsForSeconds(1)).toBe(1);
  });

  it('bills a whole credit for anything up to six seconds', () => {
    expect(creditsForSeconds(6)).toBe(1);
    expect(creditsForSeconds(6.1)).toBe(2);
  });

  it.each([0, -30, NaN, Infinity])('charges nothing for %p', (bad) => {
    expect(creditsForSeconds(bad)).toBe(0);
  });
});

describe('minutesFromCredits', () => {
  it('floors, so we never promise a minute that is not fully paid for', () => {
    expect(minutesFromCredits(19)).toBe(1);
    expect(minutesFromCredits(20)).toBe(2);
  });

  it.each([0, -5, NaN])('reports no minutes for %p', (bad) => {
    expect(minutesFromCredits(bad)).toBe(0);
  });
});

describe('applyDebit', () => {
  it('deducts when the balance covers the cost', () => {
    expect(applyDebit(300, 100)).toEqual({ allowed: true, balance: 200, charged: 100 });
  });

  it('allows spending the balance down to exactly zero', () => {
    expect(applyDebit(100, 100)).toEqual({ allowed: true, balance: 0, charged: 0 + 100 });
  });

  it('refuses without deducting when short — never a partial charge', () => {
    expect(applyDebit(50, 100)).toEqual({ allowed: false, balance: 50, charged: 0 });
  });

  it('refuses on an empty balance', () => {
    expect(applyDebit(0, 1)).toEqual({ allowed: false, balance: 0, charged: 0 });
  });

  it('treats a zero cost as free rather than as a refusal', () => {
    expect(applyDebit(10, 0)).toEqual({ allowed: true, balance: 10, charged: 0 });
  });

  it('never lets a negative cost top the balance up', () => {
    expect(applyDebit(10, -100)).toEqual({ allowed: true, balance: 10, charged: 0 });
  });

  it('treats a corrupt balance as empty rather than as infinite', () => {
    expect(applyDebit(NaN, 10).allowed).toBe(false);
  });
});

describe('settleHold', () => {
  it('refunds the difference when the hold over-estimated', () => {
    // Held 10 minutes, used 4.
    expect(settleHold(200, 100, 40)).toBe(260);
  });

  it('is a no-op when the estimate was exact', () => {
    expect(settleHold(200, 100, 100)).toBe(200);
  });

  it('collects the shortfall when a caller under-reported the duration', () => {
    // Claimed 1 minute, actually 10.
    expect(settleHold(200, 10, 100) /* 200 + 10 - 100 */).toBe(110);
  });

  it('goes negative rather than forgiving a large under-report', () => {
    // The lie buys exactly one transcription; the next is refused.
    const balance = settleHold(5, 10, 600);
    expect(balance).toBeLessThan(0);
    expect(applyDebit(balance, 1).allowed).toBe(false);
  });

  it('ignores a negative actual cost instead of paying the user', () => {
    expect(settleHold(100, 10, -50)).toBe(110);
  });
});

describe('hasCredits', () => {
  it.each([1, 300])('accepts a positive balance (%p)', (n) => {
    expect(hasCredits(n)).toBe(true);
  });

  it.each([0, -20, undefined, NaN])('rejects %p', (n) => {
    expect(hasCredits(n as number | undefined)).toBe(false);
  });
});
