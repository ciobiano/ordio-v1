import { getCaptionStylePreset, type CaptionMechanic } from '@Ordio/engine';
import type { CaptionStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';

export interface CaptionAnimationOption {
  mechanic: CaptionMechanic;
  /** The style bundle a tap applies — the plainest one running this animation. */
  styleId: CaptionStyleId;
  label: string;
  hint: string;
  gate?: FeatureKey;
}

/**
 * The four reveal animations the engine actually has — not the eight style
 * bundles behind them. Four of those bundles ran the identical phrase-cut
 * animation and differed only by stroke, accent color or glow, all of which
 * the Colors tab already edits; listing them as separate choices made the
 * picker read as repetitive and implied options that don't exist.
 *
 * Every bundle still exists in the engine — Director's looks pin the more
 * specialised ones — so pickers match on mechanic (see
 * `findAnimationForStyle`) and a Director-applied look still highlights its
 * animation correctly.
 *
 * Shared by the mobile style panel and the desktop stage bar so the two lists
 * cannot drift apart, which is exactly what happened while each kept its own.
 */
export const CAPTION_ANIMATIONS: CaptionAnimationOption[] = [
  {
    mechanic: 'progressive-reveal',
    styleId: 'editorial-reveal',
    label: 'Reveal',
    hint: 'Sentence holds, each word lights as spoken',
  },
  { mechanic: 'word-swap', styleId: 'word-pop', label: 'Pop', hint: 'One word at a time' },
  { mechanic: 'phrase-cut', styleId: 'minimal-lower-third', label: 'Cut', hint: 'Short phrase, hard cut' },
  {
    mechanic: 'static-highlight',
    styleId: 'karaoke-chip',
    label: 'Karaoke',
    hint: 'Block holds, highlight moves word to word',
  },
];

/** The animation a given style bundle runs, for driving selected state. */
export function findAnimationForStyle(styleId: CaptionStyleId): CaptionAnimationOption | undefined {
  const { mechanic } = getCaptionStylePreset(styleId);
  return CAPTION_ANIMATIONS.find((option) => option.mechanic === mechanic);
}
