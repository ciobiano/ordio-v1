import { describe, it, expect } from 'vitest';
import { CAPTION_STYLE_PRESETS, getCaptionStylePreset } from '../src/captions/presets';
import type { CaptionStyleId } from '../src/types';

const ALL_STYLE_IDS: CaptionStyleId[] = [
  'word-pop',
  'bold-outline',
  'karaoke-chip',
  'minimal-lower-third',
  'big-statement',
  'script-accent',
];

describe('CAPTION_STYLE_PRESETS', () => {
  it('has a valid entry for every CaptionStyleId', () => {
    for (const id of ALL_STYLE_IDS) {
      const preset = CAPTION_STYLE_PRESETS[id];
      expect(preset).toBeDefined();
      expect(['word-swap', 'phrase-cut', 'static-highlight']).toContain(preset.mechanic);
      expect(['plain', 'accent-swap']).toContain(preset.fontTreatment);
    }
  });

  it('getCaptionStylePreset returns the same entry as the table', () => {
    for (const id of ALL_STYLE_IDS) {
      expect(getCaptionStylePreset(id)).toBe(CAPTION_STYLE_PRESETS[id]);
    }
  });

  it('accent-swap styles declare an accentStyle', () => {
    for (const id of ALL_STYLE_IDS) {
      const preset = CAPTION_STYLE_PRESETS[id];
      if (preset.fontTreatment === 'accent-swap') {
        expect(preset.accentStyle).toBeDefined();
      }
    }
  });

  it('script-accent is the only style with a glow default', () => {
    expect(CAPTION_STYLE_PRESETS['script-accent'].glow).toBeDefined();
    const others = ALL_STYLE_IDS.filter((id) => id !== 'script-accent');
    for (const id of others) {
      expect(CAPTION_STYLE_PRESETS[id].glow).toBeUndefined();
    }
  });

  it('bold-outline is the only style with a stroke default', () => {
    expect(CAPTION_STYLE_PRESETS['bold-outline'].stroke).toBeDefined();
    const others = ALL_STYLE_IDS.filter((id) => id !== 'bold-outline');
    for (const id of others) {
      expect(CAPTION_STYLE_PRESETS[id].stroke).toBeUndefined();
    }
  });

  it('karaoke-chip is the only static-highlight style and declares a chip color', () => {
    const staticHighlightStyles = ALL_STYLE_IDS.filter(
      (id) => CAPTION_STYLE_PRESETS[id].mechanic === 'static-highlight'
    );
    expect(staticHighlightStyles).toEqual(['karaoke-chip']);
    expect(CAPTION_STYLE_PRESETS['karaoke-chip'].chipColor).toBeDefined();
  });
});
