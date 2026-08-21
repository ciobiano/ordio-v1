/**
 * How far a transcription has probably got.
 *
 * Whisper is a single request that returns once. There is no progress event to
 * report, so the stretch between "sent" and "returned" was one unbroken hold —
 * and it is the longest step in the pipeline by a wide margin. A bar that sits
 * still for a minute is not read as "working", it is read as "hung", which is
 * exactly how it was reported.
 *
 * The estimate is derived, not invented: the request time is dominated by the
 * length of the audio, which is known before the request is sent. That makes
 * this a projection from a real input rather than a decorative animation.
 *
 * It is a projection all the same, so the curve is asymptotic — it slows as it
 * goes and never reaches the ceiling. Overrunning the estimate makes the bar
 * crawl instead of stalling at 100% and then jumping, and completion is only
 * ever drawn by the real response arriving.
 */

/** Fixed cost of the round trip: upload, queueing, response. */
export const TRANSCRIBE_OVERHEAD_MS = 4_000;

/**
 * Roughly how much faster than realtime whisper-1 returns.
 *
 * Deliberately conservative. Under-estimating the speed makes the bar lag
 * slightly behind the truth, which reads as steady progress; over-estimating
 * parks it near the ceiling early, which reads as stalled.
 */
export const TRANSCRIBE_SPEED_FACTOR = 6;

/** How long a transcription of `audioSeconds` is expected to take. */
export function expectedTranscribeMs(audioSeconds: number): number {
  const audible = Number.isFinite(audioSeconds) && audioSeconds > 0 ? audioSeconds : 0;
  return TRANSCRIBE_OVERHEAD_MS + (audible * 1000) / TRANSCRIBE_SPEED_FACTOR;
}

/**
 * As close to the end as the estimate is ever allowed to claim.
 *
 * The exponential approaches 1 without reaching it in exact arithmetic, but
 * `1 - Math.exp(-1000)` is exactly 1 in float64 — so a transcription that runs
 * far past its estimate would land on the ceiling and sit there, which is the
 * stall this whole module exists to avoid. The cap keeps the claim the
 * docstring makes true in the arithmetic the code actually runs in.
 */
const CEILING = 0.999;

/**
 * The fraction of the way through, on an exponential approach.
 *
 * Reaches ~63% of the span at the expected time and ~86% at twice it, and is
 * non-decreasing without ever arriving — so it cannot claim a transcription
 * finished before the response says so.
 */
export function transcribeFraction(elapsedMs: number, expectedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  if (!Number.isFinite(expectedMs) || expectedMs <= 0) return 0;
  return Math.min(CEILING, 1 - Math.exp(-elapsedMs / expectedMs));
}

/**
 * The projected progress value, mapped onto the span this step occupies.
 *
 * `from` and `to` are on the same 0–100 scale the rest of the pipeline
 * reports, so the caller never has to convert between units — the mismatch
 * that made the desk's bar and step list wrong in the first place.
 */
export function transcribeProgressAt(
  elapsedMs: number,
  expectedMs: number,
  from: number,
  to: number
): number {
  return from + transcribeFraction(elapsedMs, expectedMs) * (to - from);
}
