import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn()', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles conditional objects', () => {
    expect(cn({ active: true, hidden: false })).toBe('active');
  });

  it('returns empty string for no truthy classes', () => {
    expect(cn(false, undefined)).toBe('');
  });

  it('merges arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });
});
