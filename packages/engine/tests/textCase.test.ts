import { describe, it, expect } from 'vitest';
import {
  applyTextCase,
  transformTranscriptCase,
  transformCaptionGroupsCase,
} from '../src/processing/captions/textCase';
import type { Word } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../src/types';

const words: Word[] = [
  { text: 'so', start: 0, end: 0.4 },
  { text: 'I', start: 0.5, end: 0.7 },
  { text: 'BUILT', start: 0.8, end: 1.2 },
  { text: 'this', start: 1.3, end: 1.6 },
];

const groups: CaptionGroup[] = [
  { wordIndices: [0, 1, 2, 3], text: 'so I BUILT this', start: 0, end: 1.6 },
];

describe('processing/captions: textCase', () => {
  describe('applyTextCase', () => {
    it('leaves the text alone when the transform is none', () => {
      expect(applyTextCase('so I BUILT this', 'none')).toBe('so I BUILT this');
    });

    it('uppercases and lowercases wholesale', () => {
      expect(applyTextCase('so I BUILT this', 'uppercase')).toBe('SO I BUILT THIS');
      expect(applyTextCase('so I BUILT this', 'lowercase')).toBe('so i built this');
    });

    it('capitalize lowers the rest of the word, so shouted source normalises', () => {
      // Without lowering the tail, "BUILT" would survive capitalize untouched
      // and sit inconsistently beside "So" and "This".
      expect(applyTextCase('so I BUILT this', 'capitalize')).toBe('So I Built This');
    });

    it('capitalize handles punctuation-adjacent and multi-space text', () => {
      expect(applyTextCase("okay  that's it", 'capitalize')).toBe("Okay  That's It");
    });
  });

  describe('transformTranscriptCase', () => {
    it('returns the original array identity when nothing changes', () => {
      // Identity matters: the render loop compares inputs to decide whether to
      // redraw, so a fresh array every frame would defeat that.
      expect(transformTranscriptCase(words, 'none')).toBe(words);
    });

    it('rewrites only the text, preserving each word timing', () => {
      const out = transformTranscriptCase(words, 'uppercase');
      expect(out.map((w) => w.text)).toEqual(['SO', 'I', 'BUILT', 'THIS']);
      expect(out.map((w) => [w.start, w.end])).toEqual(words.map((w) => [w.start, w.end]));
    });

    it('never mutates the source', () => {
      transformTranscriptCase(words, 'uppercase');
      expect(words[0].text).toBe('so');
    });

    it('caches per source and transform, so a frame loop does not recompute', () => {
      const first = transformTranscriptCase(words, 'uppercase');
      const second = transformTranscriptCase(words, 'uppercase');
      expect(second).toBe(first);
    });

    it('keeps separate entries per transform', () => {
      const upper = transformTranscriptCase(words, 'uppercase');
      const lower = transformTranscriptCase(words, 'lowercase');
      expect(upper).not.toBe(lower);
      expect(upper[0].text).toBe('SO');
      expect(lower[0].text).toBe('so');
    });
  });

  describe('transformCaptionGroupsCase', () => {
    it('rewrites group text but leaves indices and timings alone', () => {
      const out = transformCaptionGroupsCase(groups, 'uppercase');
      expect(out[0].text).toBe('SO I BUILT THIS');
      expect(out[0].wordIndices).toEqual([0, 1, 2, 3]);
      expect(out[0].start).toBe(0);
      expect(out[0].end).toBe(1.6);
    });

    it('passes the array straight through when the transform is none', () => {
      expect(transformCaptionGroupsCase(groups, 'none')).toBe(groups);
    });
  });
});
