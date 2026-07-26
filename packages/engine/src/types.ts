export type WaveformVariant = 'bars' | 'circle' | 'spectrogram' | 'none';
export type GraphicStyleId = 'graphic-frame1' | 'graphic-frame2' | null;

/** How the canvas is composed: where the visual sits and where captions sit */
export type CanvasLayout = 'top' | 'compact' | 'flipped';

/**
 * Which caption style is active. Replaces the old CaptionMode
 * (phrase/karaoke/stack/spotlight) — see
 * docs/superpowers/specs/2026-07-25-caption-style-redesign-design.md.
 * Each style is driven by one of three shared reveal mechanics
 * (word-swap, phrase-cut, static-highlight) via CAPTION_STYLE_PRESETS.
 */
export type CaptionStyleId =
  | 'word-pop'
  | 'bold-outline'
  | 'karaoke-chip'
  | 'minimal-lower-third'
  | 'big-statement'
  | 'script-accent';

export interface CaptionTransform {
  offsetXRatio: number;
  offsetYRatio: number;
  scale: number;
  rotationDeg: number;
  visible: boolean;
}

/**
 * A CaptionGroup is a timed caption segment — a timeline block that contains
 * one or more words. Modelled after CapCut's caption segments.
 *
 * IMPORTANT: `start` and `end` are independently owned timeline block boundaries.
 * They are NOT derived from the first/last word's timestamps. After a split, the
 * two resulting groups inherit the original block's start/end respectively, so
 * the timeline coverage is preserved without shrink-wrapping to word edges.
 */
export interface CaptionGroup {
  /** Words belonging to this group, must be contiguous in the transcript */
  wordIndices: number[];
  /** Combined text of all words, recomputed on merge/split */
  text: string;
  /** Block start time (seconds) — independently owned, not necessarily first word's start */
  start: number;
  /** Block end time (seconds) — independently owned, not necessarily last word's end */
  end: number;
  /**
   * Indices into wordIndices (not transcript indices) marking words rendered
   * with the active caption style's accent treatment (e.g. script-accent's
   * italic+glow swap). Manually toggled in the caption editor. Absent/empty
   * means no accent words in this group.
   */
  accentWordIndices?: number[];
  /**
   * Marks this group for the Hook Card scale boost (Ordio Director). At most
   * one group per session should carry 'hook' — applyLook in directorStore
   * clears it from every group before setting a new one. Absent/'body'
   * renders at normal scale.
   */
  role?: 'hook' | 'body';
}
