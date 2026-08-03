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
  z.object({
    type: z.literal('image'),
    // 'preset' resolves from CANVAS_PRESETS (packages/engine) — bundled
    // artwork, no Convex round trip. 'custom' resolves from a Convex
    // backgroundAssets id, same as video.
    source: z.enum(['custom', 'preset']),
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
  fontFamily: z.enum(['Inter', 'Roboto', 'Outfit', 'Poppins', 'Montserrat', 'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora', 'Instrument Serif', 'Instrument Sans']),
  fontSize: z.number().positive(),
  waveColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Additional spacing between characters (pixels) */
  characterSpacing: z.number().min(-12).max(12).default(0),
  /** Line height multiplier. Values below 1 tighten the spacing between lines. */
  lineHeight: z.number().min(0.4).max(3).default(1.4),
  /** Horizontal caption alignment. 'center' matches historical behavior. */
  textAlign: z.enum(['start', 'center', 'end']).default('center'),
  /** Vertical caption anchor. 'auto' keeps the waveform-aware placement each mechanic has always used. */
  verticalAlign: z.enum(['auto', 'top', 'center', 'bottom']).default('auto'),
  /**
   * Words held on screen per caption block. Overrides the active style's own
   * default; unset on both means content-aware sentence segmentation.
   */
  chunkWords: z.number().int().min(2).max(12).optional(),
  /**
   * How a photo/video background is darkened for caption legibility.
   * 'flat' (default) is the even full-frame wash; 'bottom' is a gradient
   * rising from the base, which keeps the top of the frame — usually the
   * subject — untouched.
   */
  backgroundScrim: z.enum(['flat', 'bottom', 'none']).default('flat'),
  /** Which caption style is active — see CAPTION_STYLE_PRESETS in @Ordio/engine. */
  captionStyleId: z
    .enum([
      'word-pop',
      'bold-outline',
      'karaoke-chip',
      'minimal-lower-third',
      'big-statement',
      'script-accent',
      'editorial-reveal',
      'cream-block',
    ])
    .default('minimal-lower-third'),
  /**
   * Text stroke. The preset supplies the default when unset, but the value is
   * honoured for every style — the renderer has always read
   * `style.strokeWidth ?? preset.stroke?.defaultWidth ?? DEFAULT`, so a style
   * whose preset declares no stroke still strokes when this is set.
   */
  strokeWidth: z.number().min(0).max(8).optional(),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Text shadow. Same preset-default-then-override rule as stroke. */
  glowIntensity: z.number().min(0).max(1).optional(),
  glowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Accent-word color override — used by styles whose preset declares an `accentColor` default (word-pop, big-statement). */
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

  /**
   * Casing applied to caption text at draw time. The transcript itself is never
   * rewritten — the user's words stay verbatim in the store and in exports of
   * the transcript; this only changes how they are painted.
   */
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),

  /**
   * The word currently being spoken, in mechanics that mark one. Today that is
   * the karaoke chip (static-highlight); the preset supplies the default chip
   * and text colours and these override them.
   */
  activeWordColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  activeWordBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Whether the active word gets a filled chip behind it at all. */
  activeWordBackgroundEnabled: z.boolean().optional(),

  /**
   * How a photo/video backdrop is fitted to the canvas.
   *   fill — crop to cover the frame (the historical behaviour)
   *   fit  — letterbox so the whole source stays visible
   *   auto — cover when the aspect ratios are close, contain when they are not
   */
  contentFit: z.enum(['fill', 'fit', 'auto']).optional(),
});

export type StyleConfig = z.infer<typeof StyleConfigSchema>;

/**
 * A candidate clip window found inside a long episode.
 * start/end are episode-absolute seconds; windows are 30–60s.
 */
export const ClipCandidateSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  hookText: z.string().min(1),
  rationale: z.string().min(1),
});

export type ClipCandidate = z.infer<typeof ClipCandidateSchema>;

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
  'centered-block',
  'urban-phrase',
  'cream-block',
  'orb-phrase',
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
  // OpenAI Structured Outputs requires every field to be present in `required`;
  // optionality has to be expressed as `.nullable()` on each leaf, not
  // `.optional()` on the wrapping object (nested optionals aren't supported —
  // see https://platform.openai.com/docs/guides/structured-outputs). The model
  // always returns this object, using null for "no override".
  overrides: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  }),
  /** Index into the session's captionGroups — Director's chosen hook phrase. */
  hookGroupIndex: z.number().int().min(0),
});

export const DirectorResponseSchema = z.object({
  looks: z.array(DirectorLookResponseSchema).length(3),
});

export type DirectorLookResponse = z.infer<typeof DirectorLookResponseSchema>;
export type DirectorResponse = z.infer<typeof DirectorResponseSchema>;
