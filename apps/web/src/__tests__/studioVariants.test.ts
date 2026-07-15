import { describe, it, expect } from 'vitest';
import { studioButton, studioPill, studioCard, studioRailRow } from '@/lib/studioVariants';

describe('studioVariants', () => {
  it('studioButton primary uses the lime accent per the design handoff', () => {
    const cls = studioButton({ variant: 'primary' });
    expect(cls).toContain('bg-acid-accent');
    expect(cls).toContain('text-acid-on-accent');
  });

  it('studioButton secondary is a neutral surface', () => {
    const cls = studioButton({ variant: 'secondary' });
    expect(cls).toContain('bg-acid-surface-1');
  });

  it('studioPill toggles active styling', () => {
    expect(studioPill({ active: true })).toContain('bg-acid-text-1');
    expect(studioPill({ active: false })).toContain('bg-acid-surface-1');
  });

  it('studioCard returns the shared card shell', () => {
    expect(studioCard()).toContain('bg-acid-surface-1');
    expect(studioCard()).toContain('rounded-acid-md');
  });

  it('studioRailRow highlights the active row', () => {
    expect(studioRailRow({ active: true })).toContain('border-acid-text-1');
    expect(studioRailRow({ active: false })).not.toContain('border-acid-text-1');
  });
});
