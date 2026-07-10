import type { ClipCandidate } from '@Ordio/shared/schemas';

const WINDOW_SEC = 45;

/**
 * Deterministic fallback when the LLM can't produce valid candidates:
 * the top-energy non-overlapping 45s windows from per-second RMS data.
 */
export function fallbackWindows(energy: number[], durationSec: number): ClipCandidate[] {
  const maxStart = Math.floor(durationSec - WINDOW_SEC);
  if (maxStart < 0) return [];

  const scores: Array<{ start: number; score: number }> = [];
  for (let start = 0; start <= maxStart; start++) {
    let sum = 0;
    for (let s = start; s < start + WINDOW_SEC && s < energy.length; s++) sum += energy[s] ?? 0;
    scores.push({ start, score: sum });
  }
  scores.sort((a, b) => b.score - a.score);

  const out: ClipCandidate[] = [];
  for (const { start } of scores) {
    const end = start + WINDOW_SEC;
    if (!out.some((k) => start < k.end && end > k.start)) {
      out.push({
        start,
        end,
        hookText: 'High-energy moment',
        rationale: 'Picked by audio energy (AI selection unavailable)',
      });
    }
    if (out.length === 3) break;
  }
  return out;
}
