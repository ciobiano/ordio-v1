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
 * Style configuration for the audiogram.
 * Guarantees visual consistency between preview and export.
 */
export const StyleConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.enum(['Inter', 'Roboto', 'Outfit', 'Poppins', 'Montserrat', 'Space Grotesk', 'DM Sans', 'Playfair Display']),
  fontSize: z.number().positive(),
  waveColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Additional spacing between wrapped lines (pixels) */
  lineSpacing: z.number().min(0).default(0),
  /** Line height multiplier (e.g., 1.4 = 140% of fontSize) */
  lineHeight: z.number().min(0.5).max(3).default(1.4),
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
