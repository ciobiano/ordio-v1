import { describe, it, expect } from 'vitest';
import { LOOK_PRESETS, getLookPreset, resolveLookStyle } from '../src/captions/lookPresets';
import { CAPTION_STYLE_PRESETS } from '../src/captions/presets';
import type { LookPresetId } from '../src/captions/lookPresets';
import type { StyleConfig } from '@Ordio/shared/schemas';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ALL_PRESET_IDS: LookPresetId[] = [
  'neon-pop',
  'street-bold',
  'sunset-karaoke',
  'clean-minimal',
  'bold-statement',
  'editorial-script',
  'warm-pop',
  'electric-outline',
];

const baseStyle: StyleConfig = {
  width: 1080,
  height: 1920,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 48,
  waveColor: '#ffffff',
  characterSpacing: 0,
  lineHeight: 1.4,
  captionStyleId: 'minimal-lower-third',
};

describe('LOOK_PRESETS', () => {
  it('has exactly 8 presets', () => {
    expect(Object.keys(LOOK_PRESETS)).toHaveLength(8);
    expect(Object.keys(LOOK_PRESETS).sort()).toEqual([...ALL_PRESET_IDS].sort());
  });

  it('each preset references a real caption style', () => {
    for (const id of ALL_PRESET_IDS) {
      const preset = LOOK_PRESETS[id];
      expect(preset.style.captionStyleId).toBeDefined();
      expect(CAPTION_STYLE_PRESETS[preset.style.captionStyleId!]).toBeDefined();
    }
  });

  it('each preset uses valid hex colors', () => {
    for (const id of ALL_PRESET_IDS) {
      const { textColor, waveColor, backgroundColor } = LOOK_PRESETS[id].style;
      if (textColor) expect(textColor).toMatch(HEX_COLOR);
      if (waveColor) expect(waveColor).toMatch(HEX_COLOR);
      if (backgroundColor) expect(backgroundColor).toMatch(HEX_COLOR);
    }
  });

  it('getLookPreset returns the same entry as the table', () => {
    for (const id of ALL_PRESET_IDS) {
      expect(getLookPreset(id)).toBe(LOOK_PRESETS[id]);
    }
  });
});

describe('resolveLookStyle', () => {
  it('merges the preset onto the base style, keeping fields the preset does not touch', () => {
    const resolved = resolveLookStyle(baseStyle, 'neon-pop');
    expect(resolved.captionStyleId).toBe('word-pop');
    expect(resolved.width).toBe(baseStyle.width);
    expect(resolved.height).toBe(baseStyle.height);
    expect(resolved.fontSize).toBe(baseStyle.fontSize);
  });

  it('applies overrides on top of the preset', () => {
    const resolved = resolveLookStyle(baseStyle, 'street-bold', { textColor: '#123456' });
    expect(resolved.textColor).toBe('#123456');
    expect(resolved.captionStyleId).toBe('bold-outline');
  });

  it('overrides take precedence over the preset\'s own values', () => {
    const preset = LOOK_PRESETS['clean-minimal'];
    const resolved = resolveLookStyle(baseStyle, 'clean-minimal', { textColor: '#abcdef' });
    expect(resolved.textColor).not.toBe(preset.style.textColor);
    expect(resolved.textColor).toBe('#abcdef');
  });
});
