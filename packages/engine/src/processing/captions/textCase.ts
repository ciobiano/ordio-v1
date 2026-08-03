import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../../types';

export type TextTransform = NonNullable<StyleConfig['textTransform']>;

/**
 * Casing applied to caption text at paint time.
 *
 * The transcript is never rewritten. The user's words are the subject of the
 * product and stay verbatim in the store, in the caption editor and in the
 * exported transcript — this only changes how they are drawn, so switching back
 * to "As spoken" is lossless.
 *
 * Applied once in `renderFrame`, before dispatch, because all four mechanics
 * take the same `transcript` and `captionGroups`. Doing it here rather than at
 * each `fillText` also means the *measurement* pass sees the transformed text,
 * which matters: uppercase is materially wider and would otherwise wrap
 * differently from how it paints.
 */
export function applyTextCase(text: string, transform: TextTransform): string {
  switch (transform) {
    case 'uppercase':
      return text.toLocaleUpperCase();
    case 'lowercase':
      return text.toLocaleLowerCase();
    case 'capitalize':
      // Only the first letter of each word; the rest is lowered so SHOUTED
      // source text doesn't survive as-is and read inconsistently.
      return text.replace(/\S+/g, (word) =>
        word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
      );
    default:
      return text;
  }
}

/**
 * Per-transform cache keyed on the source array's identity.
 *
 * This runs on every rendered frame — 60 times a second over every word in the
 * clip — so recomputing would burn real time in the export loop for a value
 * that only changes when the user picks a different casing. The outer WeakMap
 * lets a replaced transcript be collected.
 */
const transcriptCache = new WeakMap<Word[], Map<TextTransform, Word[]>>();
const groupCache = new WeakMap<CaptionGroup[], Map<TextTransform, CaptionGroup[]>>();

function cached<T extends object>(
  cache: WeakMap<T, Map<TextTransform, T>>,
  source: T,
  transform: TextTransform,
  compute: () => T
): T {
  let byTransform = cache.get(source);
  if (!byTransform) {
    byTransform = new Map();
    cache.set(source, byTransform);
  }
  const hit = byTransform.get(transform);
  if (hit) return hit;

  const value = compute();
  byTransform.set(transform, value);
  return value;
}

export function transformTranscriptCase(transcript: Word[], transform: TextTransform): Word[] {
  if (transform === 'none') return transcript;
  return cached(transcriptCache, transcript, transform, () =>
    transcript.map((word) => ({ ...word, text: applyTextCase(word.text, transform) }))
  );
}

export function transformCaptionGroupsCase(
  groups: CaptionGroup[],
  transform: TextTransform
): CaptionGroup[] {
  if (transform === 'none') return groups;
  return cached(groupCache, groups, transform, () =>
    groups.map((group) => ({ ...group, text: applyTextCase(group.text, transform) }))
  );
}
