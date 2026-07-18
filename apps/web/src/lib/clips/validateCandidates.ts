import { z } from 'zod';
import { ClipCandidateSchema, type ClipCandidate } from '@Ordio/shared/schemas';

const MIN_LEN = 30;
const MAX_LEN = 60;

/**
 * Parse and sanitize LLM-proposed clip windows.
 * Invalid entries are dropped, not repaired; overlap keeps the earlier window.
 */
export function validateCandidates(raw: unknown, durationSec: number): ClipCandidate[] {
  const parsed = z.array(ClipCandidateSchema).safeParse(raw);
  if (!parsed.success) return [];

  const valid = parsed.data
    .filter((c) => {
      const len = c.end - c.start;
      return c.start >= 0 && c.end <= durationSec && len >= MIN_LEN && len <= MAX_LEN;
    })
    .sort((a, b) => a.start - b.start);

  const out: ClipCandidate[] = [];
  for (const c of valid) {
    const overlaps = out.some((k) => c.start < k.end && c.end > k.start);
    if (!overlaps) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
