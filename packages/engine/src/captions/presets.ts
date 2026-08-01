import type { CaptionStyleId } from '../types';

export type CaptionMechanic = 'word-swap' | 'phrase-cut' | 'static-highlight' | 'progressive-reveal';

export interface CaptionStylePreset {
  mechanic: CaptionMechanic;
  /** 'accent-swap' styles honor CaptionGroup.accentWordIndices; 'plain' ignores it. */
  fontTreatment: 'plain' | 'accent-swap';
  /**
   * True when the caption block claims the whole frame and the waveform/graphic
   * zone is suppressed. Per style, not per mechanic: karaoke-chip fills the
   * screen with lyrics, but cream-block runs the same mechanic *with* a
   * waveform under it (the design pairs the two).
   */
  ownsStage: boolean;
  /** How the accented word is set apart, when fontTreatment is 'accent-swap'. */
  accentStyle?: 'color' | 'italic-glow';
  stroke?: { defaultWidth: number; defaultColor: string };
  glow?: { defaultIntensity: number; defaultColor: string };
  chipColor?: string;
  /** Text color drawn on top of the active-word chip. Defaults to near-black; light-surface styles invert it. */
  chipTextColor?: string;
  /** Chip padding/corner as ratios of fontSize. Omitted styles use the karaoke defaults. */
  chipPaddingXRatio?: number;
  chipPaddingYRatio?: number;
  chipRadiusRatio?: number;
  /** Where a 'top'-anchored block sits, as a fraction of height. Defaults to the karaoke ratio. */
  topRatio?: number;
  /**
   * Words held on screen per block when StyleConfig doesn't override it.
   * Unset means content-aware sentence segmentation, which is unbounded (up
   * to 34 words) — right for lyrics, wrong for the design study's tight
   * fixed-weight blocks where every chunk should carry the same visual mass.
   */
  defaultChunkWords?: number;
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
    ownsStage: false,
    accentStyle: 'color',
    accentColor: '#FFE14D',
  },
  'bold-outline': {
    mechanic: 'phrase-cut',
    fontTreatment: 'plain',
    ownsStage: false,
    stroke: { defaultWidth: 0.09, defaultColor: '#000000' },
  },
  'karaoke-chip': {
    mechanic: 'static-highlight',
    fontTreatment: 'plain',
    ownsStage: true,
    chipColor: '#22D3EE',
  },
  'minimal-lower-third': {
    mechanic: 'phrase-cut',
    fontTreatment: 'plain',
    ownsStage: false,
  },
  'big-statement': {
    mechanic: 'phrase-cut',
    fontTreatment: 'accent-swap',
    ownsStage: false,
    accentStyle: 'color',
    accentColor: '#FF5A5F',
  },
  'script-accent': {
    mechanic: 'phrase-cut',
    fontTreatment: 'accent-swap',
    ownsStage: false,
    accentStyle: 'italic-glow',
    glow: { defaultIntensity: 0.6, defaultColor: '#FFFFFF' },
    accentFontFamily: 'Playfair Display',
  },
  // Ordio caption-presets design study (2026-07-31). The reveal holds a whole
  // sentence and lights each word at its own timestamp — it shares the frame
  // with the visual zone rather than claiming it, so 'Orb + Phrase' can pair
  // this caption with the orb visual the way the design composes them.
  'editorial-reveal': {
    mechanic: 'progressive-reveal',
    fontTreatment: 'plain',
    ownsStage: false,
    defaultChunkWords: 6,
  },
  'cream-block': {
    mechanic: 'static-highlight',
    fontTreatment: 'plain',
    ownsStage: false,
    chipColor: '#690C05',
    chipTextColor: '#FAF7EE',
    // The study hugs the word far tighter than karaoke's pill: 3px padding
    // and a 4px corner at 29px type.
    chipPaddingXRatio: 3 / 29,
    chipPaddingYRatio: 1 / 29,
    chipRadiusRatio: 4 / 29,
    topRatio: 112 / 640,
    defaultChunkWords: 6,
  },
};

export function getCaptionStylePreset(id: CaptionStyleId): CaptionStylePreset {
  return CAPTION_STYLE_PRESETS[id];
}
