import { describe, it, expect, beforeEach } from 'vitest';
import { useProcessingStore } from '@/stores/processingStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { Word } from '@Ordio/shared/schemas';

/**
 * Re-cutting captions under a break rule. The interesting case is the scoped
 * one: re-cutting a single caption has to leave its neighbours untouched and
 * keep every word pointing at the right transcript index, because the segments
 * come back indexed against the group's slice rather than the transcript.
 */

function words(count: number): Word[] {
  let time = 0;
  return Array.from({ length: count }, (_, i) => {
    const word = { text: `w${i + 1}`, start: time, end: time + 0.4 };
    time += 0.5;
    return word;
  });
}

const store = () => useProcessingStore.getState();

/** Every transcript index covered by the groups, in order. */
const coverage = () => store().captionGroups.flatMap((g) => g.wordIndices);

beforeEach(() => {
  useProcessingStore.setState({ transcript: [], captionGroups: [], selectedGroupIndices: [] });
  useHistoryStore.getState().clearHistory();
});

describe('stores/processingStore: resegmentCaptions', () => {
  describe('scope: all', () => {
    it('re-cuts the whole transcript under the new rule', () => {
      store().setTranscript(words(12));
      store().resegmentCaptions({ mode: 'quantity', quantity: 3 }, 'all');

      expect(store().captionGroups.map((g) => g.wordIndices.length)).toEqual([3, 3, 3, 3]);
    });

    it('still covers every word exactly once, in order', () => {
      store().setTranscript(words(11));
      store().resegmentCaptions({ mode: 'single' }, 'all');

      expect(coverage()).toEqual([...Array(11).keys()]);
    });

    it('is one undo step', () => {
      store().setTranscript(words(9));
      const before = store().captionGroups.length;

      store().resegmentCaptions({ mode: 'single' }, 'all');

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('change breaks');
      expect(useHistoryStore.getState().past[0].snapshot.kind).toBe('captions');
      // The snapshot is the state *before* the change.
      const snapshot = useHistoryStore.getState().past[0].snapshot;
      if (snapshot.kind !== 'captions') throw new Error('expected a caption snapshot');
      expect(snapshot.captionGroups).toHaveLength(before);
    });
  });

  describe('scope: one caption', () => {
    it('replaces only that group and leaves the others alone', () => {
      store().setTranscript(words(12));
      store().resegmentCaptions({ mode: 'quantity', quantity: 4 }, 'all');
      const [first, , third] = store().captionGroups;
      expect(store().captionGroups).toHaveLength(3);

      // Split the middle group into single words.
      store().resegmentCaptions({ mode: 'single' }, 1);

      const groups = store().captionGroups;
      expect(groups).toHaveLength(1 + 4 + 1);
      expect(groups[0].wordIndices).toEqual(first.wordIndices);
      expect(groups[groups.length - 1].wordIndices).toEqual(third.wordIndices);
    });

    it('maps segment indices back through the group, not the transcript', () => {
      store().setTranscript(words(12));
      store().resegmentCaptions({ mode: 'quantity', quantity: 4 }, 'all');
      // Group 1 owns transcript words 4..7.
      expect(store().captionGroups[1].wordIndices).toEqual([4, 5, 6, 7]);

      store().resegmentCaptions({ mode: 'single' }, 1);

      // Naive indexing would have produced 0,1,2,3 here.
      expect(store().captionGroups.slice(1, 5).map((g) => g.wordIndices)).toEqual([
        [4], [5], [6], [7],
      ]);
    });

    it('keeps whole-transcript coverage intact', () => {
      store().setTranscript(words(12));
      store().resegmentCaptions({ mode: 'quantity', quantity: 4 }, 'all');
      store().resegmentCaptions({ mode: 'single' }, 2);

      expect(coverage()).toEqual([...Array(12).keys()]);
    });

    it('carries the right text and timings onto the new groups', () => {
      store().setTranscript(words(8));
      store().resegmentCaptions({ mode: 'quantity', quantity: 4 }, 'all');
      store().resegmentCaptions({ mode: 'quantity', quantity: 2 }, 0);

      const [a, b] = store().captionGroups;
      expect(a.text).toBe('w1 w2');
      expect(b.text).toBe('w3 w4');
      expect(a.start).toBe(0);
      expect(b.end).toBeCloseTo(1.9);
    });
  });

  describe('guards', () => {
    it('does nothing without a transcript', () => {
      store().resegmentCaptions({ mode: 'single' }, 'all');
      expect(store().captionGroups).toEqual([]);
      expect(useHistoryStore.getState().past).toHaveLength(0);
    });

    it('does nothing — and records nothing — for an index out of range', () => {
      store().setTranscript(words(6));
      useHistoryStore.getState().clearHistory();
      const before = store().captionGroups;

      store().resegmentCaptions({ mode: 'single' }, 99);

      expect(store().captionGroups).toBe(before);
      expect(useHistoryStore.getState().past).toHaveLength(0);
    });
  });
});
