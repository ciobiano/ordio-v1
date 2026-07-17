// Sliding-window rate limiting for the transcription-token route.
// Pure decision function (unit-tested) + a small in-memory store.
//
// Honest limitation: the store is per serverless instance, so the effective
// ceiling is limit × warm-instances. That still brakes the realistic abuse
// case (one client hammering one warm lambda); move to Convex/Redis if token
// minting ever needs a hard global ceiling.

export interface RateLimitResult {
  allowed: boolean;
  /** Timestamps still inside the window (the caller stores these back). */
  timestamps: number[];
}

export function checkRateLimit(
  timestamps: number[],
  now: number,
  limit: number,
  windowMs: number
): RateLimitResult {
  const inWindow = timestamps.filter((t) => now - t < windowMs);
  if (inWindow.length >= limit) {
    return { allowed: false, timestamps: inWindow };
  }
  return { allowed: true, timestamps: [...inWindow, now] };
}

const store = new Map<string, number[]>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): boolean {
  const result = checkRateLimit(store.get(key) ?? [], now, limit, windowMs);
  store.set(key, result.timestamps);
  return result.allowed;
}
