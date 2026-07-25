import type { CaptionStyleId } from '../types';

export type CaptionMechanic = 'word-swap' | 'phrase-cut' | 'static-highlight';

export interface CaptionStylePreset {
  mechanic: CaptionMechanic;
  /** 'accent-swap' styles honor CaptionGroup.accentWordIndices; 'plain' ignores it. */
  fontTreatment: 'plain' | 'accent-swap';
  /** How the accented word is set apart, when fontTreatment is 'accent-swap'. */
  accentStyle?: 'color' | 'italic-glow';
  stroke?: { defaultWidth: number; defaultColor: string };
  glow?: { defaultIntensity: number; defaultColor: string };
  chipColor?: string;
  accentColor?: string;
  /** Font family swapped in for the accented word when accentStyle is 'italic-glow'. Must be one of StyleConfig's font enum values so it's guaranteed preloaded. */
  accentFontFamily?: string;
}

/**
 * The single source of truth mapping each caption style to its reveal
 * mechanic and default visual treatment. See
 * docs/superpowers/specs/2026-07-25-caption-style-redesign-design.md.
 */
export const CAPTION_STYLE_PRESETS: Record<CaptionStyleId, CaptionStylePreset> = {
  'word-pop': {
    mechanic: 'word-swap',
    fontTreatment: 'accent-swap',
    accentStyle: 'color',
    accentColor: '#FFE14D',
  },
  'bold-outline': {
    mechanic: 'phrase-cut',
    fontTreatment: 'plain',
    stroke: { defaultWidth: 0.09, defaultColor: '#000000' },
  },
  'karaoke-chip': {
    mechanic: 'static-highlight',
    fontTreatment: 'plain',
    chipColor: '#22D3EE',
  },
  'minimal-lower-third': {
    mechanic: 'phrase-cut',
    fontTreatment: 'plain',
  },
  'big-statement': {
    mechanic: 'phrase-cut',
    fontTreatment: 'accent-swap',
    accentStyle: 'color',
    accentColor: '#FF5A5F',
  },
  'script-accent': {
    mechanic: 'phrase-cut',
    fontTreatment: 'accent-swap',
    accentStyle: 'italic-glow',
    glow: { defaultIntensity: 0.6, defaultColor: '#FFFFFF' },
    accentFontFamily: 'Playfair Display',
  },
};

export function getCaptionStylePreset(id: CaptionStyleId): CaptionStylePreset {
  return CAPTION_STYLE_PRESETS[id];
}
