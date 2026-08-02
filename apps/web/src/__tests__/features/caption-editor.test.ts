/**
 * Acceptance tests for Caption Editor — Gherkin style with Vitest
 * Run with: pnpm test src/__tests__/features/caption-editor.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProcessingStore } from '@/stores/processingStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useExportHistory } from '@/hooks/export/useExportHistory';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { Word } from '@Ordio/shared/schemas';

/**
 * Undo/redo left processingStore for the shared history behind the transport
 * bar. These drive the real hook rather than a reimplementation of it, so the
 * tests stay honest if the apply logic changes. Playback and the trimmer are
 * only touched when restoring a *trim* snapshot, so stubs suffice here.
 */
function renderHistory() {
  const playback = { load: () => {} } as unknown as UsePlaybackReturn;
  const trimmer = { resetAll: () => {} } as unknown as UseAudioTrimmerReturn;
  return renderHook(() => useExportHistory({ playback, trimmer })).result;
}

// ─── Test data helpers ─────────────────────────────────────────────────────

function createMockWords(count: number): Word[] {
  const words: Word[] = [];
  let time = 0;
  for (let i = 0; i < count; i++) {
    const duration = 0.4;
    words.push({ text: `word${i + 1}`, start: time, end: time + duration });
    time += duration + 0.1; // 0.1s gap between words
  }
  return words;
}

function resetStore(words?: Word[]) {
  useProcessingStore.setState({
    transcript: [],
    captionGroups: [],
    selectedGroupIndices: [],
  });
  useHistoryStore.getState().clearHistory();
  if (words) {
    useProcessingStore.getState().setTranscript(words);
  }
}

// ─── Feature: Caption Group Management ────────────────────────────────────

describe('Feature: Caption Group Management', () => {
  beforeEach(() => resetStore());

  describe('Background: Given a transcript with words', () => {
    it('should initialize groups from transcript', () => {
      resetStore(createMockWords(12));
      const { captionGroups } = useProcessingStore.getState();
      expect(captionGroups.length).toBeGreaterThan(0);
    });
  });

  // ── Merge ──────────────────────────────────────────────────────────────

  describe('Scenario: Merge two caption groups together', () => {
    it('should reduce group count by 1', () => {
      resetStore(createMockWords(24));
      const before = useProcessingStore.getState().captionGroups.length;
      expect(before).toBeGreaterThan(1);
      useProcessingStore.getState().mergeDown(0);
      expect(useProcessingStore.getState().captionGroups.length).toBe(before - 1);
    });

    it('should take A.start and B.end as the merged block boundaries', () => {
      resetStore(createMockWords(12));
      const { captionGroups } = useProcessingStore.getState();
      const expectedStart = captionGroups[0].start;
      const expectedEnd   = captionGroups[1].end;
      useProcessingStore.getState().mergeDown(0);
      const merged = useProcessingStore.getState().captionGroups[0];
      expect(merged.start).toBe(expectedStart);
      expect(merged.end).toBe(expectedEnd);
    });
  });

  describe('Scenario: Merged group bridges the gap between segments', () => {
    it('should span A.start → B.end, bridging any silence gap', () => {
      // Create two separate groups with a deliberate gap
      const words: Word[] = [
        { text: 'hello', start: 0.0, end: 0.5 },
        { text: 'world', start: 2.0, end: 2.5 }, // 1.5s gap from group A
        { text: 'foo',   start: 4.0, end: 4.5 },
        { text: 'bar',   start: 4.6, end: 5.0 },
      ];
      resetStore(words);

      // Force two groups manually so we control timing exactly
      useProcessingStore.setState({
        captionGroups: [
          { wordIndices: [0], text: 'hello', start: 0.0, end: 1.5 },
          { wordIndices: [1], text: 'world', start: 2.0, end: 3.0 },
        ],
      });

      useProcessingStore.getState().mergeDown(0);
      const merged = useProcessingStore.getState().captionGroups[0];
      // Gap between 1.5s and 2.0s is bridged — merged block spans full range
      expect(merged.start).toBe(0.0);
      expect(merged.end).toBe(3.0);
      expect(merged.wordIndices).toEqual([0, 1]);
    });
  });

  describe('Scenario: Merge Up', () => {
    it('should combine current group with the previous one', () => {
      resetStore(createMockWords(18));
      const before = useProcessingStore.getState().captionGroups.length;
      useProcessingStore.getState().mergeUp(2);
      expect(useProcessingStore.getState().captionGroups.length).toBe(before - 1);
    });
  });

  // ── Split ──────────────────────────────────────────────────────────────

  describe('Scenario: Split at word boundary — split word becomes first of new segment', () => {
    it('should create two groups with correct word distribution', () => {
      resetStore(createMockWords(12));
      const before = useProcessingStore.getState().captionGroups.length;
      const group0 = useProcessingStore.getState().captionGroups[0];
      const splitPosition = Math.floor(group0.wordIndices.length / 2);
      expect(splitPosition).toBeGreaterThan(0);

      useProcessingStore.getState().splitAtWord(0, splitPosition);

      const { captionGroups, transcript } = useProcessingStore.getState();
      expect(captionGroups.length).toBe(before + 1);

      const segA = captionGroups[0];
      const segB = captionGroups[1];
      expect(segA.wordIndices).toEqual(group0.wordIndices.slice(0, splitPosition));
      expect(segB.wordIndices).toEqual(group0.wordIndices.slice(splitPosition));

      // The split word is the first word of segment B.
      const splitWordIdx = group0.wordIndices[splitPosition];
      const splitWordStart = transcript[splitWordIdx].start;
      expect(segA.end).toBe(splitWordStart);
      expect(segB.start).toBe(splitWordStart);
    });

    it('should preserve the original block start for segment A', () => {
      resetStore(createMockWords(12));
      const originalStart = useProcessingStore.getState().captionGroups[0].start;
      useProcessingStore.getState().splitAtWord(0, 3);
      const segA = useProcessingStore.getState().captionGroups[0];
      expect(segA.start).toBe(originalStart);
    });

    it('should preserve the original block end for segment B', () => {
      resetStore(createMockWords(12));
      const originalEnd = useProcessingStore.getState().captionGroups[0].end;
      useProcessingStore.getState().splitAtWord(0, 3);
      const groups = useProcessingStore.getState().captionGroups;
      const segB = groups[1];
      expect(segB.end).toBe(originalEnd);
    });
  });

  describe('Scenario: Split at playhead time — finds next word after gap', () => {
    it('should split correctly when playhead is in a silence gap between words', () => {
      // Group with 4 words: word1 [0.0-0.4], word2 [0.5-0.9], word3 [2.0-2.4], word4 [2.5-2.9]
      const words: Word[] = [
        { text: 'word1', start: 0.0, end: 0.4 },
        { text: 'word2', start: 0.5, end: 0.9 },
        { text: 'word3', start: 2.0, end: 2.4 }, // 1.1s gap from word2
        { text: 'word4', start: 2.5, end: 2.9 },
      ];
      resetStore(words);

      useProcessingStore.setState({
        captionGroups: [{
          wordIndices: [0, 1, 2, 3],
          text: 'word1 word2 word3 word4',
          start: 0.0,
          end: 3.0,
        }],
      });

      // Playhead at 1.5s — in the gap between word2 (ends 0.9) and word3 (starts 2.0)
      useProcessingStore.getState().splitAtTime(0, 1.5);

      const { captionGroups } = useProcessingStore.getState();
      expect(captionGroups.length).toBe(2);
      // word3 (start 2.0) should be the first word of segment B
      expect(captionGroups[1].wordIndices[0]).toBe(2);
      expect(captionGroups[1].start).toBe(1.5);
    });
  });

  describe('Scenario: Cannot split a single-word group', () => {
    it('should not change group count when splitting a 1-word group', () => {
      const words: Word[] = [{ text: 'solo', start: 0.0, end: 1.0 }];
      resetStore(words);
      const before = useProcessingStore.getState().captionGroups.length;
      useProcessingStore.getState().splitAtWord(0, 0); // position 0 is invalid
      expect(useProcessingStore.getState().captionGroups.length).toBe(before);
    });
  });

  // ── Undo / Redo ────────────────────────────────────────────────────────

  describe('Scenario: Undo restores the previous caption state', () => {
    it('should restore groups after a merge', () => {
      resetStore(createMockWords(12));
      const before = useProcessingStore.getState().captionGroups;
      const beforeLength = before.length;

      const history = renderHistory();

      act(() => useProcessingStore.getState().mergeDown(0));
      expect(useProcessingStore.getState().captionGroups.length).toBe(beforeLength - 1);

      act(() => history.current.undo());
      expect(useProcessingStore.getState().captionGroups.length).toBe(beforeLength);
    });

    it('should restore groups after a split', () => {
      resetStore(createMockWords(12));
      const beforeLength = useProcessingStore.getState().captionGroups.length;

      const history = renderHistory();

      act(() => useProcessingStore.getState().splitAtWord(0, 3));
      expect(useProcessingStore.getState().captionGroups.length).toBe(beforeLength + 1);

      act(() => history.current.undo());
      expect(useProcessingStore.getState().captionGroups.length).toBe(beforeLength);
    });

    it('should do nothing when undo stack is empty', () => {
      resetStore(createMockWords(6));
      const before = useProcessingStore.getState().captionGroups.length;
      const history = renderHistory();

      act(() => history.current.undo()); // should be a no-op
      expect(useProcessingStore.getState().captionGroups.length).toBe(before);
      expect(history.current.canUndo).toBe(false);
    });
  });

  describe('Scenario: Redo re-applies the undone action', () => {
    it('should re-apply a merge after undo', () => {
      resetStore(createMockWords(12));
      const initial = useProcessingStore.getState().captionGroups.length;

      const history = renderHistory();

      act(() => useProcessingStore.getState().mergeDown(0));
      act(() => history.current.undo());
      expect(useProcessingStore.getState().captionGroups.length).toBe(initial);

      act(() => history.current.redo());
      expect(useProcessingStore.getState().captionGroups.length).toBe(initial - 1);
    });

    it('should clear redo stack after a new mutation', () => {
      resetStore(createMockWords(12));
      const history = renderHistory();

      act(() => useProcessingStore.getState().mergeDown(0));
      act(() => history.current.undo());

      // A new mutation abandons the redo branch
      act(() => useProcessingStore.getState().mergeDown(0));
      expect(useHistoryStore.getState().future.length).toBe(0);
    });
  });

  // ── Selection ──────────────────────────────────────────────────────────

  describe('Scenario: Select multiple caption groups', () => {
    it('should support multi-select with add/remove toggle', () => {
      resetStore(createMockWords(18));
      useProcessingStore.getState().selectGroup(0, false);
      useProcessingStore.getState().selectGroup(1, true);
      const { selectedGroupIndices } = useProcessingStore.getState();
      expect(selectedGroupIndices.length).toBe(2);
    });

    it('should clear selection', () => {
      resetStore(createMockWords(18));
      useProcessingStore.getState().selectAll();
      useProcessingStore.getState().clearSelection();
      expect(useProcessingStore.getState().selectedGroupIndices.length).toBe(0);
    });
  });

  // ── Smart Timing ───────────────────────────────────────────────────────

  describe('Scenario: Squeeze gaps between caption groups', () => {
    it('should not crash and groups should remain valid', () => {
      resetStore(createMockWords(12));
      useProcessingStore.getState().squeezeGaps(0.15);
      const { captionGroups } = useProcessingStore.getState();
      expect(captionGroups.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: Expand gaps for readability', () => {
    it('should not crash and groups should remain valid', () => {
      resetStore(createMockWords(12));
      useProcessingStore.getState().expandGaps(0.2);
      const { captionGroups } = useProcessingStore.getState();
      expect(captionGroups.length).toBeGreaterThan(0);
    });
  });
});

// ─── Feature: Caption Editor UI ───────────────────────────────────────────

describe('Feature: Caption Editor UI', () => {
  describe('Scenario: Display group rows with timing info', () => {
    it('should create groups with valid timing information', () => {
      resetStore(createMockWords(12));
      const { captionGroups } = useProcessingStore.getState();
      const group = captionGroups[0];
      expect(group.text).toBeDefined();
      expect(typeof group.start).toBe('number');
      expect(typeof group.end).toBe('number');
      expect(group.end).toBeGreaterThan(group.start);
    });
  });

  describe('Scenario: Select group updates selection array', () => {
    it('should add group index to selection', () => {
      resetStore(createMockWords(12));
      useProcessingStore.getState().selectGroup(0, false);
      const { selectedGroupIndices } = useProcessingStore.getState();
      expect(selectedGroupIndices).toContain(0);
    });
  });
});

// ─── Feature: Keyboard Shortcuts ─────────────────────────────────────────

describe('Feature: Keyboard Shortcuts', () => {
  describe('Scenario: Cmd+A selects all groups', () => {
    it('should select all groups', () => {
      resetStore(createMockWords(18));
      useProcessingStore.getState().selectAll();
      const { selectedGroupIndices, captionGroups } = useProcessingStore.getState();
      expect(selectedGroupIndices.length).toBe(captionGroups.length);
    });
  });
});
