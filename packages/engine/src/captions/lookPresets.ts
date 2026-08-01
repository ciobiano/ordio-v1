import type { StyleConfig, LookPresetId } from '@Ordio/shared/schemas';
import type { WaveformVariant } from '../types';
import { CANVAS_PRESETS } from '../backgrounds/canvasPresets';

export type { LookPresetId };

/**
 * Maps each non-solid look to one of the 20 canvas-preset artworks (see
 * packages/engine/src/backgrounds/canvasPresets.ts). This is a taste call —
 * which flat geometric composition reads as "neon", "sunset", "electric" —
 * not a mechanical one. First pass below picks by matching each look's own
 * waveColor accent to a preset's palette; swap any of these for a different
 * preset id freely, nothing else depends on which one is chosen.
 */
const LOOK_CANVAS_PRESET: Record<
  'neon-pop' | 'sunset-karaoke' | 'bold-statement' | 'warm-pop' | 'electric-outline',
  string
> = {
  'neon-pop': 'bow', // pale acid-yellow rainbow — matches waveColor #c6ff3d
  'sunset-karaoke': 'rise', // bright orange — matches waveColor #FF8A4A
  'bold-statement': 'reveal', // cobalt blue — matches waveColor #4D7CFF
  'warm-pop': 'zip', // magenta — matches waveColor #FF2E7E
  'electric-outline': 'tamber', // cyan/teal — matches waveColor #00D4FF
};

for (const [look, presetId] of Object.entries(LOOK_CANVAS_PRESET)) {
  if (!presetId) {
    throw new Error(`LOOK_CANVAS_PRESET['${look}'] is unset — pick a canvas preset id in lookPresets.ts`);
  }
  if (!CANVAS_PRESETS.some((p) => p.id === presetId)) {
    throw new Error(`LOOK_CANVAS_PRESET['${look}'] references unknown preset id "${presetId}"`);
  }
}

/**
 * Ordio Director's curated look library — 8 hand-tuned StyleConfig bundles,
 * each pairing one of the 6 shipped caption styles with a complementary
 * font/color/background. Director's LLM call picks one of these (by id) per
 * look, optionally overriding accentColor/textColor — it never invents a
 * font, background, or caption style from scratch. See
 * docs/superpowers/specs/2026-07-25-ordio-director-design.md.
 *
 * LookPresetId is imported from @Ordio/shared (not declared here) so this
 * table and the /api/direct response schema can never drift out of sync —
 * a missing/extra key below fails to compile.
 */
export interface LookPreset {
  label: string;
  /** Merged onto the session's existing StyleConfig — only overrides the fields listed here (width/height/fontSize etc. stay whatever the session already has). */
  style: Partial<StyleConfig>;
  /**
   * The visual this look is composed against. Lives outside StyleConfig
   * because waveformStyle is its own store field — but a look that couldn't
   * set it would be incomplete ('Orb + Phrase' would render bars).
   */
  waveformStyle?: WaveformVariant;
  /**
   * Type size as a fraction of canvas width, not absolute pixels. The design
   * study's sizes are only meaningful against its own 360px frame (33px there
   * is 9.2% of the width); pinning the px value would make the look correct
   * at one export format and wrong at every other. Resolved on apply, after
   * which it is an ordinary fontSize the user can still drag.
   */
  fontSizeRatio?: number;
  /** Letter-spacing in em, resolved against the font size above. */
  characterSpacingEm?: number;
}

export const LOOK_PRESETS: Record<LookPresetId, LookPreset> = {
  'neon-pop': {
    label: 'Neon Pop',
    style: {
      captionStyleId: 'word-pop',
      fontFamily: 'Space Grotesk',
      textColor: '#ffffff',
      waveColor: '#c6ff3d',
      backgroundColor: '#0a0b0a',
      background: { type: 'image', source: 'preset', assetId: LOOK_CANVAS_PRESET['neon-pop'] },
    },
  },
  'street-bold': {
    label: 'Street Bold',
    style: {
      captionStyleId: 'bold-outline',
      fontFamily: 'Montserrat',
      textColor: '#ffffff',
      waveColor: '#ffffff',
      backgroundColor: '#000000',
      background: { type: 'solid', color: '#000000' },
    },
  },
  'sunset-karaoke': {
    label: 'Sunset Karaoke',
    style: {
      captionStyleId: 'karaoke-chip',
      fontFamily: 'Poppins',
      textColor: '#ffffff',
      waveColor: '#FF8A4A',
      backgroundColor: '#1a0a12',
      background: { type: 'image', source: 'preset', assetId: LOOK_CANVAS_PRESET['sunset-karaoke'] },
    },
  },
  'clean-minimal': {
    label: 'Clean Minimal',
    style: {
      captionStyleId: 'minimal-lower-third',
      fontFamily: 'Inter',
      textColor: '#ffffff',
      waveColor: '#ffffff',
      backgroundColor: '#0a0b0a',
      background: { type: 'solid', color: '#0a0b0a' },
    },
  },
  'bold-statement': {
    label: 'Bold Statement',
    style: {
      captionStyleId: 'big-statement',
      fontFamily: 'Outfit',
      textColor: '#ffffff',
      waveColor: '#4D7CFF',
      backgroundColor: '#05060f',
      background: { type: 'image', source: 'preset', assetId: LOOK_CANVAS_PRESET['bold-statement'] },
    },
  },
  'editorial-script': {
    label: 'Editorial Script',
    style: {
      captionStyleId: 'script-accent',
      fontFamily: 'Lora',
      textColor: '#ffffff',
      waveColor: '#ffffff',
      backgroundColor: '#000000',
      background: { type: 'solid', color: '#000000' },
    },
  },
  'warm-pop': {
    label: 'Warm Pop',
    style: {
      captionStyleId: 'word-pop',
      fontFamily: 'DM Sans',
      textColor: '#ffffff',
      waveColor: '#FF2E7E',
      backgroundColor: '#1a0a12',
      background: { type: 'image', source: 'preset', assetId: LOOK_CANVAS_PRESET['warm-pop'] },
    },
  },
  'electric-outline': {
    label: 'Electric Outline',
    style: {
      captionStyleId: 'bold-outline',
      fontFamily: 'Space Grotesk',
      textColor: '#ffffff',
      waveColor: '#00D4FF',
      backgroundColor: '#05060f',
      background: { type: 'image', source: 'preset', assetId: LOOK_CANVAS_PRESET['electric-outline'] },
    },
  },

  // --- Ordio caption-presets design study (2026-07-31) ---
  // Each of these four is a whole frame composition, not just a caption
  // treatment, so they pin waveformStyle and both alignments rather than
  // inheriting whatever the session happened to be set to. Only cream-block
  // carries a waveform in the study; the other three are deliberately bare.
  'centered-block': {
    label: 'Centered Block',
    style: {
      captionStyleId: 'editorial-reveal',
      fontFamily: 'Instrument Serif',
      textAlign: 'center',
      verticalAlign: 'center',
      chunkWords: 6,
      lineHeight: 1.18,
      textColor: '#FFFFFF',
      waveColor: '#FFFFFF',
      backgroundColor: '#000000',
      background: { type: 'solid', color: '#000000' },
    },
    waveformStyle: 'none',
    fontSizeRatio: 33 / 360,
    characterSpacingEm: 0.002,
  },
  // Built to sit over the creator's own footage: black until they add one, and
  // anchored low so the frame's subject stays visible above the type.
  'urban-phrase': {
    label: 'Urban Phrase',
    style: {
      captionStyleId: 'editorial-reveal',
      fontFamily: 'Instrument Serif',
      textAlign: 'center',
      verticalAlign: 'bottom',
      chunkWords: 5,
      lineHeight: 1.3,
      backgroundScrim: 'bottom',
      textColor: '#FDFCF7',
      waveColor: '#FDFCF7',
      backgroundColor: '#000000',
      background: { type: 'solid', color: '#000000' },
    },
    waveformStyle: 'none',
    fontSizeRatio: 19 / 360,
  },
  // The orb takes the visual slot and sits high; the phrase reads under it.
  'orb-phrase': {
    label: 'Orb + Phrase',
    style: {
      captionStyleId: 'editorial-reveal',
      fontFamily: 'Instrument Sans',
      textAlign: 'center',
      verticalAlign: 'bottom',
      // The study hardcodes 3 here regardless of the global chunk size —
      // "phrase pace", so the line under the orb stays short.
      chunkWords: 3,
      lineHeight: 1.35,
      textColor: '#FFFFFF',
      waveColor: '#FFFFFF',
      backgroundColor: '#000000',
      background: { type: 'solid', color: '#000000' },
    },
    waveformStyle: 'orb',
    fontSizeRatio: 16 / 360,
    characterSpacingEm: -0.005,
  },
  'cream-block': {
    label: 'Cream Block',
    style: {
      captionStyleId: 'cream-block',
      fontFamily: 'Instrument Sans',
      textAlign: 'center',
      verticalAlign: 'top',
      chunkWords: 6,
      lineHeight: 1.34,
      textColor: '#690C05',
      waveColor: '#5E6B75',
      backgroundColor: '#F2ECDC',
      background: { type: 'solid', color: '#F2ECDC' },
    },
    waveformStyle: 'baseline',
    fontSizeRatio: 29 / 360,
    characterSpacingEm: -0.02,
  },
};

export function getLookPreset(id: LookPresetId): LookPreset {
  return LOOK_PRESETS[id];
}

/**
 * Merges a Director-picked preset (+ optional accentColor/textColor override)
 * onto the session's current StyleConfig, producing the full style a look's
 * live-preview card renders and, if applied, the session adopts.
 */
export function resolveLookStyle(
  baseStyle: StyleConfig,
  presetId: LookPresetId,
  overrides?: { accentColor?: string | null; textColor?: string | null }
): StyleConfig {
  const preset = LOOK_PRESETS[presetId];
  const style = { ...baseStyle, ...preset.style };

  if (preset.fontSizeRatio) {
    // Clamped so a very small canvas (the Director preview card) can't resolve
    // to sub-pixel type, and StyleConfig's positive-number contract holds.
    style.fontSize = Math.max(8, Math.round(baseStyle.width * preset.fontSizeRatio));

    // A look that pins its type size owns the whole typographic setting, so
    // tracking resolves too — including back to normal when the study spells
    // no letter-spacing. Leaving it alone would let a value the user dialled
    // in for some other look ride along into this one.
    const em = preset.characterSpacingEm ?? 0;
    style.characterSpacing = Number((style.fontSize * em).toFixed(2));
  }

  if (overrides?.accentColor) style.accentColor = overrides.accentColor;
  if (overrides?.textColor) style.textColor = overrides.textColor;
  return style;
}
