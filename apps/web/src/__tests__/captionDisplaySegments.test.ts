import { describe, expect, it } from 'vitest';
import type { Word } from '@Ordio/shared/schemas';
import {
  buildOneLinePhraseSegments,
  buildSentenceSegments,
} from '@/lib/captions/display';

function word(text: string, index: number, gap = 0.08): Word {
  const start = index * (0.34 + gap);
  return {
    text,
    start,
    end: start + 0.34,
  };
}

function wordsFromText(text: string): Word[] {
  return text.split(' ').map((part, index) => word(part, index));
}

describe('caption display segments', () => {
  it('builds karaoke scenes as complete punctuation-led sentences', () => {
    const transcript = wordsFromText('This is the first sentence. This is the second one.');

    expect(buildSentenceSegments(transcript).map((segment) => segment.text)).toEqual([
      'This is the first sentence.',
      'This is the second one.',
    ]);
  });

  it('uses a long pause as a sentence fallback when punctuation is missing', () => {
    const transcript = wordsFromText('We pause here then continue');
    transcript[2] = { ...transcript[2], end: 1 };
    transcript[3] = { ...transcript[3], start: 1.9, end: 2.2 };

    expect(buildSentenceSegments(transcript).map((segment) => segment.text)).toEqual([
      'We pause here',
      'then continue',
    ]);
  });

  it('keeps phrase segments within a single measured line', () => {
    const transcript = wordsFromText('This phrase is too long to keep as one readable caption');
    const measureText = (text: string) => text.length * 10;
    const maxWidth = 180;

    const segments = buildOneLinePhraseSegments(transcript, measureText, maxWidth);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => measureText(segment.text) <= maxWidth)).toBe(true);
  });
});
