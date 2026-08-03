import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../../types';

export type TextTransform = NonNullable<StyleConfig['textTransform']>;

/** How the text is restyled at paint time. Casing and punctuation travel
 *  together because they share one cache and one application point. */
export interface CaptionTextOptions {
  transform: TextTransform;
  hidePunctuation: boolean;
}

/**
 * Punctuation the transcription step attaches to a word. Only trailing marks
 * are stripped: an apostrophe or a hyphen inside a word is part of the word
 * ("don't", "twenty-two"), not something Whisper added.
 */
const TRAILING_PUNCTUATION_RE = /[.,!?;:—–-]+$/;

export function stripTrailingPunctuation(text: string): string {
  const stripped = text.replace(TRAILING_PUNCTUATION_RE, '');
  // A word that is *only* punctuation would vanish; keep it rather than
  // leaving a gap in the line.
  return stripped.length > 0 ? stripped : text;
}

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
const transcriptCache = new WeakMap<Word[], Map<string, Word[]>>();
const groupCache = new WeakMap<CaptionGroup[], Map<string, CaptionGroup[]>>();

const cacheKey = (options: CaptionTextOptions) =>
  `${options.transform}:${options.hidePunctuation ? 1 : 0}`;

const isIdentity = (options: CaptionTextOptions) =>
  options.transform === 'none' && !options.hidePunctuation;

function cached<T extends object>(
  cache: WeakMap<T, Map<string, T>>,
  source: T,
  key: string,
  compute: () => T
): T {
  let byKey = cache.get(source);
  if (!byKey) {
    byKey = new Map();
    cache.set(source, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;

  const value = compute();
  byKey.set(key, value);
  return value;
}

/** Punctuation first, then casing — stripping after capitalize would leave the
 *  casing decided by a character that is no longer there. */
function restyle(text: string, options: CaptionTextOptions): string {
  const base = options.hidePunctuation ? stripTrailingPunctuation(text) : text;
  return applyTextCase(base, options.transform);
}

export function restyleTranscript(transcript: Word[], options: CaptionTextOptions): Word[] {
  if (isIdentity(options)) return transcript;
  return cached(transcriptCache, transcript, cacheKey(options), () =>
    transcript.map((word) => ({ ...word, text: restyle(word.text, options) }))
  );
}

export function restyleCaptionGroups(
  groups: CaptionGroup[],
  options: CaptionTextOptions
): CaptionGroup[] {
  if (isIdentity(options)) return groups;
  return cached(groupCache, groups, cacheKey(options), () =>
    groups.map((group) => ({
      ...group,
      // Group text is a joined sentence, so each word is stripped individually
      // rather than only the final mark on the line.
      text: group.text
        .split(/\s+/)
        .map((word) => restyle(word, options))
        .join(' '),
    }))
  );
}
