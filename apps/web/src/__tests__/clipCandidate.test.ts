import { describe, it, expect } from 'vitest';
import { ClipCandidateSchema } from '@Ordio/shared/schemas';

describe('ClipCandidateSchema', () => {
  it('accepts a valid candidate', () => {
    const c = { start: 61.2, end: 105.9, hookText: 'the moment everything changed', rationale: 'strong opener' };
    expect(ClipCandidateSchema.parse(c)).toEqual(c);
  });

  it('rejects negative times and empty hookText', () => {
    expect(ClipCandidateSchema.safeParse({ start: -1, end: 10, hookText: 'x', rationale: 'y' }).success).toBe(false);
    expect(ClipCandidateSchema.safeParse({ start: 0, end: 10, hookText: '', rationale: 'y' }).success).toBe(false);
  });
});
