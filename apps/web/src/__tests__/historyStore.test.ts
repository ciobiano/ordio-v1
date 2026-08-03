import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore, type HistoryEntry } from '@/stores/historyStore';
import type { CaptionGroup } from '@/stores/types';

/**
 * The unified undo history behind the transport bar. Caption edits are cheap
 * and keep a deep stack; trim commits carry a whole AudioBuffer and are capped
 * far lower. The interesting logic is that those two budgets coexist without
 * breaking the ordering of the stack.
 */

const captionEntry = (n: number): HistoryEntry => ({
  label: `edit ${n}`,
  snapshot: {
    kind: 'captions',
    captionGroups: [{ wordIndices: [n], text: `g${n}`, start: n, end: n + 1 }] as CaptionGroup[],
    transcript: [{ text: `g${n}`, start: n, end: n + 1 }],
  },
});

// The store only ever holds the reference — it never reads the audio.
const trimEntry = (n: number): HistoryEntry => ({
  label: `cut ${n}`,
  snapshot: {
    kind: 'trim',
    audioBuffer: { duration: n } as AudioBuffer,
    transcript: [{ text: `w${n}`, start: 0, end: 1 }],
  },
});

const labels = (entries: HistoryEntry[]) => entries.map((entry) => entry.label);

describe('stores: historyStore', () => {
  beforeEach(() => useHistoryStore.getState().clearHistory());

  describe('round trip', () => {
    it('undo returns the previous entry and banks the current one for redo', () => {
      const store = useHistoryStore.getState();
      store.push(captionEntry(1));

      const restored = useHistoryStore.getState().undo(captionEntry(99));

      expect(restored?.label).toBe('edit 1');
      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(labels(useHistoryStore.getState().future)).toEqual(['edit 99']);
    });

    it('redo walks back the other way', () => {
      useHistoryStore.getState().push(captionEntry(1));
      useHistoryStore.getState().undo(captionEntry(99));

      const restored = useHistoryStore.getState().redo(captionEntry(1));

      expect(restored?.label).toBe('edit 99');
      expect(useHistoryStore.getState().future).toHaveLength(0);
      expect(labels(useHistoryStore.getState().past)).toEqual(['edit 1']);
    });

    it('returns null on an empty stack rather than throwing', () => {
      expect(useHistoryStore.getState().undo(captionEntry(1))).toBeNull();
      expect(useHistoryStore.getState().redo(captionEntry(1))).toBeNull();
    });

    it('a new action abandons the redo branch', () => {
      useHistoryStore.getState().push(captionEntry(1));
      useHistoryStore.getState().undo(captionEntry(2));
      expect(useHistoryStore.getState().future).toHaveLength(1);

      useHistoryStore.getState().push(captionEntry(3));

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });

  describe('budgets', () => {
    it('keeps 50 caption entries and drops the oldest beyond that', () => {
      for (let i = 1; i <= 55; i += 1) useHistoryStore.getState().push(captionEntry(i));

      const past = useHistoryStore.getState().past;
      expect(past).toHaveLength(50);
      expect(past[0].label).toBe('edit 6');
      expect(past[49].label).toBe('edit 55');
    });

    it('keeps only 5 trim entries, because each pins a decoded AudioBuffer', () => {
      for (let i = 1; i <= 8; i += 1) useHistoryStore.getState().push(trimEntry(i));

      const past = useHistoryStore.getState().past;
      expect(past).toHaveLength(5);
      expect(labels(past)).toEqual(['cut 4', 'cut 5', 'cut 6', 'cut 7', 'cut 8']);
    });

    it('evicts from the oldest end only, so surviving entries stay in order', () => {
      // Interleave so a naive "drop the oldest heavy entry" would reorder.
      useHistoryStore.getState().push(captionEntry(1));
      for (let i = 1; i <= 6; i += 1) {
        useHistoryStore.getState().push(trimEntry(i));
        useHistoryStore.getState().push(captionEntry(i + 1));
      }

      const past = useHistoryStore.getState().past;

      // Over the heavy budget by one, so everything up to and including the
      // first trim goes — never a hole punched in the middle.
      expect(past.filter((e) => e.snapshot.kind === 'trim')).toHaveLength(5);
      expect(labels(past)).toEqual([
        'edit 2', 'cut 2', 'edit 3', 'cut 3', 'edit 4',
        'cut 4', 'edit 5', 'cut 5', 'edit 6', 'cut 6', 'edit 7',
      ]);
    });

    it('applies the same budget to the redo stack', () => {
      for (let i = 1; i <= 6; i += 1) useHistoryStore.getState().push(captionEntry(i));
      for (let i = 1; i <= 6; i += 1) useHistoryStore.getState().undo(trimEntry(i));

      expect(useHistoryStore.getState().future.filter((e) => e.snapshot.kind === 'trim')).toHaveLength(5);
    });
  });

  it('clearHistory drops both stacks', () => {
    useHistoryStore.getState().push(captionEntry(1));
    useHistoryStore.getState().undo(captionEntry(2));

    useHistoryStore.getState().clearHistory();

    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });
});
