import { describe, it, expect } from 'vitest';
import { BackgroundSchema, StyleConfigSchema } from '../src/schemas';

describe('BackgroundSchema', () => {
  it('accepts a valid gradient background', () => {
    const result = BackgroundSchema.safeParse({
      type: 'gradient',
      variant: 'sunset',
      decoration: 'blob',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a gradient background without a decoration (optional)', () => {
    const result = BackgroundSchema.safeParse({ type: 'gradient', variant: 'electric' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown gradient variant', () => {
    const result = BackgroundSchema.safeParse({ type: 'gradient', variant: 'not-a-real-variant' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown decoration', () => {
    const result = BackgroundSchema.safeParse({
      type: 'gradient',
      variant: 'acid-signal',
      decoration: 'sparkles',
    });
    expect(result.success).toBe(false);
  });

  it('still accepts solid and video backgrounds', () => {
    expect(BackgroundSchema.safeParse({ type: 'solid', color: '#000000' }).success).toBe(true);
    expect(
      BackgroundSchema.safeParse({ type: 'video', source: 'curated', assetId: 'loop-1' }).success
    ).toBe(true);
  });
});

const baseStyle = {
  width: 1080,
  height: 1080,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter' as const,
  fontSize: 48,
  waveColor: '#ffffff',
};

describe('StyleConfigSchema captionStyleId', () => {
  it('accepts every valid caption style id', () => {
    const ids = [
      'word-pop',
      'bold-outline',
      'karaoke-chip',
      'minimal-lower-third',
      'big-statement',
      'script-accent',
    ];
    for (const captionStyleId of ids) {
      const result = StyleConfigSchema.safeParse({ ...baseStyle, captionStyleId });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an unknown caption style id', () => {
    const result = StyleConfigSchema.safeParse({ ...baseStyle, captionStyleId: 'phrase' });
    expect(result.success).toBe(false);
  });

  it('defaults captionStyleId to minimal-lower-third when omitted', () => {
    const result = StyleConfigSchema.parse(baseStyle);
    expect(result.captionStyleId).toBe('minimal-lower-third');
  });

  it('accepts optional stroke and glow fields', () => {
    const result = StyleConfigSchema.safeParse({
      ...baseStyle,
      captionStyleId: 'bold-outline',
      strokeWidth: 0.1,
      strokeColor: '#000000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a stroke width outside 0-8', () => {
    const result = StyleConfigSchema.safeParse({
      ...baseStyle,
      captionStyleId: 'bold-outline',
      strokeWidth: 12,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a glow intensity outside 0-1', () => {
    const result = StyleConfigSchema.safeParse({
      ...baseStyle,
      captionStyleId: 'script-accent',
      glowIntensity: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
