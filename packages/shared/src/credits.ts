/**
 * The credit ledger's arithmetic, with no I/O.
 *
 * Credits meter the one thing that costs real money per use: sending audio to
 * Whisper. Recording and export happen on the user's device and are free to us,
 * so they are free to them.
 *
 * Lives in `shared` rather than beside the Convex functions so it can be tested
 * — `packages/convex` has no test runner — and so the API route and the UI
 * agree with the ledger on what a minute costs.
 */

/**
 * 10 credits to the minute, i.e. one credit buys six seconds.
 *
 * Chosen so the mental arithmetic is free: 150 credits is obviously 15 minutes.
 * Credits rather than raw minutes because they let a future feature charge a
 * different rate — HD cleanup at 30/min, say — out of the same wallet, without
 * migrating anyone's balance.
 */
export const CREDITS_PER_MINUTE = 10;

/**
 * Audio enhancement costs more per minute than transcription, because it runs
 * on a GPU we rent by the second rather than an API we pay by the minute.
 *
 * The dominant cost is not the work — MossFormer2 needs roughly 7 GPU-seconds
 * per audio-minute — but Modal's `scaledown_window`, which keeps the A10G warm
 * after the last request. An isolated request drags that whole idle tail behind
 * it, so the true cost is mostly *per request* and only partly per minute.
 * These rates are set high enough to cover a short clip that pays for the tail
 * on its own, and are generous on longer clips where the tail amortises.
 *
 * Enhancement is optional and off by default, so nobody spends this by accident.
 */
export const ENHANCE_CREDITS_PER_MINUTE = {
  clean: 20,
  hd: 30,
} as const;

export type EnhanceLevel = keyof typeof ENHANCE_CREDITS_PER_MINUTE;

/**
 * The one-time welcome grant: 30 minutes, and the only way credits ever enter
 * an account now that nothing is for sale.
 *
 * That makes this number the whole cost model. Maximum lifetime spend per
 * signup is one grant, so total exposure is `signups × 30 minutes` and nothing
 * else — no subscription, no refill, no way for one user to run up a bill.
 *
 * Budget honestly at **≈ $0.69 per signup**, not the $0.36 the Whisper line
 * item alone suggests. Every recorded minute is transcribed twice: once live
 * through the Realtime API for disposable captions (≈ $0.017/min, and *not*
 * metered here) and once through Whisper for the authoritative transcript
 * (≈ $0.006/min, metered). The live pass is the larger cost and the invisible
 * one. See `/api/realtime/transcription-token`.
 */
export const WELCOME_GRANT_CREDITS = 300;

/**
 * What a stretch of audio costs, rounded up to a whole credit.
 *
 * Rounding up rather than to nearest means a 61-second clip is never billed as
 * a minute — the user always pays for at most six seconds more than they used,
 * and we are never the ones eating the remainder.
 */
export function creditsForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.ceil((seconds / 60) * CREDITS_PER_MINUTE);
}

/**
 * What enhancing a stretch of audio costs, rounded up to a whole credit.
 *
 * Separate from `creditsForSeconds` so the two rates can move independently —
 * Whisper's price and Modal's price have nothing to do with each other.
 */
export function enhanceCreditsForSeconds(seconds: number, level: EnhanceLevel): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const rate = ENHANCE_CREDITS_PER_MINUTE[level];
  if (rate === undefined) return 0;
  return Math.ceil((seconds / 60) * rate);
}

/** Whole minutes a balance is worth — what the UI shows instead of credits. */
export function minutesFromCredits(credits: number): number {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return Math.floor(credits / CREDITS_PER_MINUTE);
}

export interface DebitOutcome {
  /** False when the balance could not cover the cost; nothing was deducted. */
  allowed: boolean;
  /** The balance to persist. Unchanged from `balance` when `allowed` is false. */
  balance: number;
  /** How much was actually taken. Zero when refused. */
  charged: number;
}

/**
 * Take `cost` from `balance` if it covers it.
 *
 * All-or-nothing on purpose: a partial debit would leave the caller having paid
 * for a transcription it is about to be refused.
 */
export function applyDebit(balance: number, cost: number): DebitOutcome {
  const safeBalance = Number.isFinite(balance) ? balance : 0;
  const safeCost = Number.isFinite(cost) && cost > 0 ? cost : 0;

  if (safeCost === 0) return { allowed: true, balance: safeBalance, charged: 0 };
  if (safeBalance < safeCost) return { allowed: false, balance: safeBalance, charged: 0 };

  return { allowed: true, balance: safeBalance - safeCost, charged: safeCost };
}

/**
 * Settle a hold against what the work actually cost.
 *
 * The hold is placed from a duration the client reports, because only the
 * client knows it before the audio is sent. Whisper reports the true duration
 * afterwards, and this reconciles the two — refunding an over-estimate, and
 * collecting the shortfall when a caller under-reported to get past the hold.
 *
 * The balance is allowed to go negative on a shortfall. That is the point: an
 * under-reporting caller keeps the one transcription they lied for, and is then
 * refused every subsequent one until they are square again.
 */
export function settleHold(balance: number, held: number, actualCost: number): number {
  const safeBalance = Number.isFinite(balance) ? balance : 0;
  const safeHeld = Number.isFinite(held) && held > 0 ? held : 0;
  const safeActual = Number.isFinite(actualCost) && actualCost > 0 ? actualCost : 0;

  return safeBalance + safeHeld - safeActual;
}

/** Whether a balance can pay for anything at all. */
export function hasCredits(balance: number | undefined): boolean {
  return Number.isFinite(balance) && (balance as number) > 0;
}
