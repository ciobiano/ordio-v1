import { z } from 'zod';

/**
 * Represents a single word in the transcription.
 * @property start - Start time in seconds
 * @property end - End time in seconds
 * @property text - The word text
 */
export const WordSchema = z.object({
  text: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});

export type Word = z.infer<typeof WordSchema>;

/**
 * The full timeline of words for the audiogram.
 */
export const TimelineSchema = z.object({
  words: z.array(WordSchema),
  duration: z.number().min(0),
});

export type Timeline = z.infer<typeof TimelineSchema>;

/**
 * Background for the audiogram canvas: a solid color or a looping video.
 * Video backgrounds resolve by source — 'curated' via the static
 * BACKGROUND_LIBRARY manifest, 'custom' via a Convex backgroundAssets id.
 */
export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('solid'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  z.object({
    type: z.literal('video'),
    source: z.enum(['curated', 'custom']),
    assetId: z.string().min(1),
  }),
  z.object({
    type: z.literal('gradient'),
    variant: z.enum(['sunset', 'electric', 'acid-signal']),
    decoration: z.enum(['blob', 'grain', 'none']).optional(),
  }),
]);

export type Background = z.infer<typeof BackgroundSchema>;

/**
 * Style configuration for the audiogram.
 * Guarantees visual consistency between preview and export.
 */
export const StyleConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /**
   * Rich background (solid | video). Optional and additive: when absent,
   * renderers fall back to backgroundColor as an implicit solid background.
   */
  background: BackgroundSchema.optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.enum(['Inter', 'Roboto', 'Outfit', 'Poppins', 'Montserrat', 'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora']),
  fontSize: z.number().positive(),
  waveColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Additional spacing between characters (pixels) */
  characterSpacing: z.number().min(-12).max(12).default(0),
  /** Line height multiplier. Values below 1 tighten the spacing between lines. */
  lineHeight: z.number().min(0.4).max(3).default(1.4),
  /** Which caption style is active — see CAPTION_STYLE_PRESETS in @Ordio/engine. */
  captionStyleId: z
    .enum([
      'word-pop',
      'bold-outline',
      'karaoke-chip',
      'minimal-lower-third',
      'big-statement',
      'script-accent',
    ])
    .default('minimal-lower-third'),
  /** Text stroke — used by styles whose preset declares a `stroke` default (e.g. bold-outline). */
  strokeWidth: z.number().min(0).max(8).optional(),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Text glow — used by styles whose preset declares a `glow` default (e.g. script-accent). */
  glowIntensity: z.number().min(0).max(1).optional(),
  glowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Accent-word color override — used by styles whose preset declares an `accentColor` default (word-pop, big-statement). */
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type StyleConfig = z.infer<typeof StyleConfigSchema>;

/**
 * Job configuration payload for generating a render.
 */
export const JobConfigSchema = z.object({
  timeline: TimelineSchema,
  style: StyleConfigSchema,
  audioStorageId: z.string(),
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

/**
 * Ordio Director's curated look-preset ids — the single source of truth,
 * since both the LLM response schema (here) and the preset table
 * (LOOK_PRESETS in @Ordio/engine) need the exact same id list. Engine
 * imports this type rather than declaring its own, so a mismatched preset
 * key fails to compile instead of silently drifting from what the schema
 * accepts.
 */
export const LOOK_PRESET_IDS = [
  'neon-pop',
  'street-bold',
  'sunset-karaoke',
  'clean-minimal',
  'bold-statement',
  'editorial-script',
  'warm-pop',
  'electric-outline',
] as const;
export type LookPresetId = (typeof LOOK_PRESET_IDS)[number];

/**
 * Structured-output contract for /api/direct. Constrains the LLM to picking
 * a preset id (mostly enum selection) plus small bounded overrides, rather
 * than generating a full StyleConfig — keeps hallucination risk low while
 * still letting each look feel tailored to the transcript. See
 * docs/superpowers/specs/2026-07-25-ordio-director-design.md.
 */
export const DirectorLookResponseSchema = z.object({
  presetId: z.enum(LOOK_PRESET_IDS),
  overrides: z
    .object({
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .optional(),
  /** Index into the session's captionGroups — Director's chosen hook phrase. */
  hookGroupIndex: z.number().int().min(0),
});

export const DirectorResponseSchema = z.object({
  looks: z.array(DirectorLookResponseSchema).length(3),
});

export type DirectorLookResponse = z.infer<typeof DirectorLookResponseSchema>;
export type DirectorResponse = z.infer<typeof DirectorResponseSchema>;
