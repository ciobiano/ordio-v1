import { describe, it, expect } from 'vitest';
import { getCanvasDimensions } from '@/lib/store';

describe('getCanvasDimensions', () => {
  it('returns 1080x1080 for square', () => {
    expect(getCanvasDimensions('square')).toEqual({ width: 1080, height: 1080 });
  });

  it('returns 1080x1920 for vertical', () => {
    expect(getCanvasDimensions('vertical')).toEqual({ width: 1080, height: 1920 });
  });

  it('returns 1920x1080 for horizontal', () => {
    expect(getCanvasDimensions('horizontal')).toEqual({ width: 1920, height: 1080 });
  });

  it('returns 1080x1350 for instagram', () => {
    const dims = getCanvasDimensions('instagram');
    expect(dims).toEqual({ width: 1080, height: 1350 });
  });
});
