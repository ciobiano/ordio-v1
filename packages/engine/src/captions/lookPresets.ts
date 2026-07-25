import type { StyleConfig, LookPresetId } from '@Ordio/shared/schemas';

export type { LookPresetId };

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
      background: { type: 'gradient', variant: 'acid-signal', decoration: 'grain' },
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
      background: { type: 'gradient', variant: 'sunset', decoration: 'blob' },
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
      background: { type: 'gradient', variant: 'electric', decoration: 'blob' },
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
      background: { type: 'gradient', variant: 'sunset', decoration: 'grain' },
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
      background: { type: 'gradient', variant: 'electric', decoration: 'grain' },
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
  overrides?: { accentColor?: string; textColor?: string }
): StyleConfig {
  return { ...baseStyle, ...LOOK_PRESETS[presetId].style, ...overrides };
}
