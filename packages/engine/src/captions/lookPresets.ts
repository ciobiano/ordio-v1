import type { StyleConfig, LookPresetId } from '@Ordio/shared/schemas';
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
  const style = { ...baseStyle, ...LOOK_PRESETS[presetId].style };
  if (overrides?.accentColor) style.accentColor = overrides.accentColor;
  if (overrides?.textColor) style.textColor = overrides.textColor;
  return style;
}
