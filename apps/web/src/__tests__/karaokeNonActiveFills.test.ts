import { describe, it, expect } from 'vitest';
import { karaokeNonActiveFills } from '@Ordio/engine/video/karaoke';

describe('karaokeNonActiveFills', () => {
  it('lightens dark caption text on a light background', () => {
    const { upcoming, complete } = karaokeNonActiveFills({
      textColor: '#111111',
      backgroundColor: '#ffffff',
    });
    expect(upcoming).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    expect(complete).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    const up = upcoming.match(/\d+/g)!.map(Number);
    expect(up[0]).toBeGreaterThan(111);
    expect(up[1]).toBeGreaterThan(111);
    expect(up[2]).toBeGreaterThan(111);
    const co = complete.match(/\d+/g)!.map(Number);
    // Complete is blended less toward white than upcoming, so it stays closer to the dark caption color.
    expect(co[0]).toBeLessThan(up[0]);
  });

  it('darkens light caption text on a dark background', () => {
    const { upcoming, complete } = karaokeNonActiveFills({
      textColor: '#ffffff',
      backgroundColor: '#000000',
    });
    const up = upcoming.match(/\d+/g)!.map(Number);
    expect(up[0]).toBeLessThan(255);
    expect(up[1]).toBeLessThan(255);
    expect(up[2]).toBeLessThan(255);
    const co = complete.match(/\d+/g)!.map(Number);
    expect(co[0]).toBeGreaterThan(up[0]);
  });

  it('falls back when hex is invalid', () => {
    const { upcoming, complete } = karaokeNonActiveFills({
      textColor: 'not-a-color',
      backgroundColor: '#ffffff',
    });
    expect(upcoming).toBe('rgb(58, 58, 62)');
    expect(complete).toBe('rgb(88, 88, 94)');
  });
});
