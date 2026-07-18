import type { Word } from '@Ordio/shared/schemas';

const STRONG_PUNCTUATION = /[.?!;:]$/;
const SOFT_PUNCTUATION = /[,]$/;

export function hasStrongPunctuation(word: Word): boolean {
  return STRONG_PUNCTUATION.test(word.text.trim());
}

export function hasSoftPunctuation(word: Word): boolean {
  return SOFT_PUNCTUATION.test(word.text.trim());
}

export function pauseAfter(words: Word[], index: number): number {
  const current = words[index];
  const next = words[index + 1];
  if (!current || !next) return 0;
  return Math.max(0, next.start - current.end);
}

export function joinWords(words: Word[]): string {
  return words.map((word) => word.text).join(' ');
}
