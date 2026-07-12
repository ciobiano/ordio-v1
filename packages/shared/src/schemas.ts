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
