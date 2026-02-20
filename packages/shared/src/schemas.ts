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
  fontFamily: z.enum(['Inter', 'Roboto', 'Outfit']),
  fontSize: z.number().positive(),
  waveColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
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
