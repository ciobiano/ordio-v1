'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word } from '@Ordio/shared/schemas';
import type { TranscriptionSource, EnhanceTier, CaptionGroup } from './types';

const WORDS_PER_PHRASE = 6;
const MAX_UNDO_STEPS = 50;

// ─── Immutable merge helper ────────────────────────────────────────────────

function mergeTwoGroupsImmutable(
  captionGroups: CaptionGroup[],
  index: number,
  direction: 'down' | 'up'
): CaptionGroup[] {
  if (direction === 'down') {
    if (index < 0 || index >= captionGroups.length - 1) return captionGroups;
    const current = captionGroups[index];
    const next = captionGroups[index + 1];
    const merged: CaptionGroup = {
      wordIndices: [...current.wordIndices, ...next.wordIndices],
      text: `${current.text} ${next.text}`.replace(/\s+/g, ' ').trim(),
      // Bridge the gap: take A.start and B.end — silence in between is preserved
      start: current.start,
      end: next.end,
    };
    return [
      ...captionGroups.slice(0, index),
      merged,
      ...captionGroups.slice(index + 2),
    ];
  } else {
    if (index <= 0 || index >= captionGroups.length) return captionGroups;
    const prev = captionGroups[index - 1];
    const current = captionGroups[index];
    const merged: CaptionGroup = {
      wordIndices: [...prev.wordIndices, ...current.wordIndices],
      text: `${prev.text} ${current.text}`.replace(/\s+/g, ' ').trim(),
      start: prev.start,
      end: current.end,
    };
    return [
      ...captionGroups.slice(0, index - 1),
      merged,
      ...captionGroups.slice(index + 1),
    ];
  }
}

// ─── Initial group builder ─────────────────────────────────────────────────

function buildInitialGroups(words: Word[]): CaptionGroup[] {
  const groups: CaptionGroup[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_PHRASE) {
    const chunk = words.slice(i, i + WORDS_PER_PHRASE);
    groups.push({
      wordIndices: chunk.map((_, idx) => i + idx),
      text: chunk.map(w => w.text).join(' '),
      // start/end are timeline block boundaries, not derived per-word
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
    });
  }
  return groups;
}

// ─── Undo snapshot type ────────────────────────────────────────────────────

interface CaptionSnapshot {
  captionGroups: CaptionGroup[];
}

// ─── State shape ───────────────────────────────────────────────────────────

const initialPersisted = {
  enhanceTier: 'none' as EnhanceTier,
};

const initialSession = {
  transcript: [] as Word[],
  isTranscribing: false,
  transcriptionSource: null as TranscriptionSource,
  captionGroups: [] as CaptionGroup[],
  selectedGroupIndices: [] as number[],
  captionUndoStack: [] as CaptionSnapshot[],
  captionRedoStack: [] as CaptionSnapshot[],
  isEnhancing: false,
  enhanceProgress: 0,
  isExporting: false,
  exportProgress: 0,
  exportedUrl: null as string | null,
};

interface ProcessingState {
  // Transcribing
  transcript: Word[];
  isTranscribing: boolean;
  transcriptionSource: TranscriptionSource;
  /** Editorial grouping of words into caption segments */
  captionGroups: CaptionGroup[];
  /** Selected group indices for bulk operations */
  selectedGroupIndices: number[];

  // Undo / Redo stacks for caption group mutations
  captionUndoStack: CaptionSnapshot[];
  captionRedoStack: CaptionSnapshot[];

  // Enhancing (Audio)
  enhanceTier: EnhanceTier;
  isEnhancing: boolean;
  enhanceProgress: number;

  // Exporting (Video)
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;

  // Actions
  setTranscript: (transcript: Word[]) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscriptionSource: (source: TranscriptionSource) => void;

  // Caption Group Actions
  /**
   * Split group at a specific word position within the group.
   * The word at `wordPositionInGroup` becomes the FIRST word of the new segment.
   * Example: split at "industry" → Segment A ends before "industry", Segment B starts with "industry".
   */
  splitAtWord: (groupIndex: number, wordPositionInGroup: number, exactTime?: number) => void;
  /**
   * Split group at the playhead time.
   * Finds the first word whose start >= time (i.e. the next word after the playhead).
   * That word becomes the first word of the second segment.
   * Falls back to mid-split if no valid word boundary exists.
   */
  splitAtTime: (groupIndex: number, time: number) => void;
  mergeDown: (index: number) => void;
  mergeUp: (index: number) => void;
  selectGroup: (index: number, multi?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Smart Timing
  squeezeGaps: (maxGapSeconds?: number) => void;
  expandGaps: (minGapSeconds?: number) => void;

  // Cursor-aware merge: when a cursor is placed at position N in the group:
  //   mergeUpAtCursor — words [0..N-1] go into previous group, [N..end] stay
  //   mergeDownAtCursor — [0..N-1] stay, [N..end] go into next group
  //   If no cursor (null), falls back to full-group merge
  mergeUpAtCursor: (index: number, cursorPosition: number | null) => void;
  mergeDownAtCursor: (index: number, cursorPosition: number | null) => void;

  // Undo / Redo
  undoCaptions: () => void;
  redoCaptions: () => void;
  canUndoCaptions: boolean;
  canRedoCaptions: boolean;

  setEnhanceTier: (tier: EnhanceTier) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setEnhanceProgress: (progress: number) => void;

  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportedUrl: (url: string | null) => void;

  resetProcessing: () => void;
}

export const useProcessingStore = create<ProcessingState>()(
  persist(
    (set, get) => {
      // ── Internal helpers ──────────────────────────────────────────────────

      /** Snapshot current groups onto the undo stack before a mutation. */
      function pushUndo() {
        const { captionGroups, captionUndoStack } = get();
        const snapshot: CaptionSnapshot = { captionGroups: [...captionGroups] };
        const newStack = [...captionUndoStack, snapshot].slice(-MAX_UNDO_STEPS);
        set({ captionUndoStack: newStack, captionRedoStack: [] });
      }

      return {
        ...initialPersisted,
        ...initialSession,

        // Derived booleans (recomputed from stack lengths)
        get canUndoCaptions() { return get().captionUndoStack.length > 0; },
        get canRedoCaptions() { return get().captionRedoStack.length > 0; },

        setTranscript: (transcript) => {
          const groups = buildInitialGroups(transcript);
          set({
            transcript,
            captionGroups: groups,
            selectedGroupIndices: [],
            captionUndoStack: [],
            captionRedoStack: [],
          });
        },
        setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
        setTranscriptionSource: (transcriptionSource) => set({ transcriptionSource }),

        // ── Split at word boundary ────────────────────────────────────────
        // The word at wordPositionInGroup becomes the FIRST word of segment B.
        splitAtWord: (groupIndex, wordPositionInGroup, exactTime) => {
          const { captionGroups, transcript } = get();
          if (groupIndex < 0 || groupIndex >= captionGroups.length) return;

          const group = captionGroups[groupIndex];

          // Must have at least 2 words and split position must be interior
          if (wordPositionInGroup <= 0 || wordPositionInGroup >= group.wordIndices.length) return;

          pushUndo();

          const wordsA = group.wordIndices.slice(0, wordPositionInGroup);
          const wordsB = group.wordIndices.slice(wordPositionInGroup);

          // Boundary: exact time if provided (playhead split), otherwise the split word's start time
          const splitBoundary = exactTime ?? transcript[wordsB[0]].start;

          const segmentA: CaptionGroup = {
            wordIndices: wordsA,
            text: wordsA.map(wi => transcript[wi].text).join(' '),
            start: group.start,       // inherit original block start
            end: splitBoundary,       // end exactly at the split boundary
          };

          const segmentB: CaptionGroup = {
            wordIndices: wordsB,
            text: wordsB.map(wi => transcript[wi].text).join(' '),
            start: splitBoundary,     // start exactly at the split boundary
            end: group.end,           // inherit original block end
          };

          const newGroups = [
            ...captionGroups.slice(0, groupIndex),
            segmentA,
            segmentB,
            ...captionGroups.slice(groupIndex + 1),
          ];

          set({ captionGroups: newGroups, selectedGroupIndices: [] });
        },

        // ── Split at playhead time ────────────────────────────────────────
        // Finds the first word starting at or after `time`.
        // That word becomes the first word of segment B.
        splitAtTime: (groupIndex, time) => {
          const { captionGroups, transcript } = get();
          if (groupIndex < 0 || groupIndex >= captionGroups.length) return;

          const group = captionGroups[groupIndex];
          if (group.wordIndices.length < 2) return;

          // Strategy 1: find the first word whose start >= time (next word after playhead)
          let splitPosition = group.wordIndices.findIndex(wi => transcript[wi].start >= time);

          // Strategy 2: playhead is ON a word (mid-utterance) — that word goes to segment B
          if (splitPosition < 0) {
            splitPosition = group.wordIndices.findIndex(wi => {
              const w = transcript[wi];
              return time >= w.start && time < w.end;
            });
          }

          // Strategy 3: last resort — split at midpoint (playhead is past all words)
          if (splitPosition <= 0) {
            splitPosition = Math.ceil(group.wordIndices.length / 2);
          }

          // Delegate to splitAtWord with the resolved position AND the exact time
          get().splitAtWord(groupIndex, splitPosition, time);
        },

        // ── Merge Down (CapCut "merge with next") ────────────────────────
        mergeDown: (index) => {
          const { captionGroups } = get();
          if (index < 0 || index >= captionGroups.length - 1) return;
          pushUndo();
          const newGroups = mergeTwoGroupsImmutable(captionGroups, index, 'down');
          set({ captionGroups: newGroups, selectedGroupIndices: [] });
        },

        // ── Merge Up (CapCut "merge with previous") ──────────────────────
        mergeUp: (index) => {
          const { captionGroups } = get();
          if (index <= 0 || index >= captionGroups.length) return;
          pushUndo();
          const newGroups = mergeTwoGroupsImmutable(captionGroups, index, 'up');
          set({ captionGroups: newGroups, selectedGroupIndices: [] });
        },

        // ── Cursor-aware Merge Up ─────────────────────────────────────────
        // cursor=N → words [0..N-1] go to previous group, words [N..end] stay
        // cursor=null → full group merge (same as mergeUp)
        mergeUpAtCursor: (index, cursorPosition) => {
          const { captionGroups, transcript } = get();
          if (index <= 0 || index >= captionGroups.length) return;

          // No cursor or cursor at boundary: fall back to full merge
          if (cursorPosition === null || cursorPosition <= 0 || cursorPosition >= captionGroups[index].wordIndices.length) {
            get().mergeUp(index);
            return;
          }

          pushUndo();

          const prev = captionGroups[index - 1];
          const curr = captionGroups[index];
          const wordsGoingUp = curr.wordIndices.slice(0, cursorPosition);
          const wordsStaying = curr.wordIndices.slice(cursorPosition);
          const splitBoundary = transcript[wordsStaying[0]].start;

          const updatedPrev: CaptionGroup = {
            wordIndices: [...prev.wordIndices, ...wordsGoingUp],
            text: `${prev.text} ${wordsGoingUp.map(wi => transcript[wi].text).join(' ')}`.trim(),
            start: prev.start,
            end: splitBoundary, // prev block now ends at the cursor split point
          };

          const updatedCurr: CaptionGroup = {
            wordIndices: wordsStaying,
            text: wordsStaying.map(wi => transcript[wi].text).join(' '),
            start: splitBoundary, // remaining block starts at cursor
            end: curr.end,
          };

          const newGroups = [
            ...captionGroups.slice(0, index - 1),
            updatedPrev,
            updatedCurr,
            ...captionGroups.slice(index + 1),
          ];
          set({ captionGroups: newGroups, selectedGroupIndices: [index] });
        },

        // ── Cursor-aware Merge Down ───────────────────────────────────────
        // cursor=N → words [0..N-1] stay, words [N..end] go to next group
        // cursor=null → full group merge (same as mergeDown)
        mergeDownAtCursor: (index, cursorPosition) => {
          const { captionGroups, transcript } = get();
          if (index < 0 || index >= captionGroups.length - 1) return;

          // No cursor or cursor at boundary: fall back to full merge
          if (cursorPosition === null || cursorPosition <= 0 || cursorPosition >= captionGroups[index].wordIndices.length) {
            get().mergeDown(index);
            return;
          }

          pushUndo();

          const curr = captionGroups[index];
          const next = captionGroups[index + 1];
          const wordsStaying = curr.wordIndices.slice(0, cursorPosition);
          const wordsGoingDown = curr.wordIndices.slice(cursorPosition);
          const splitBoundary = transcript[wordsGoingDown[0]].start;

          const updatedCurr: CaptionGroup = {
            wordIndices: wordsStaying,
            text: wordsStaying.map(wi => transcript[wi].text).join(' '),
            start: curr.start,
            end: splitBoundary, // current block ends at cursor
          };

          const updatedNext: CaptionGroup = {
            wordIndices: [...wordsGoingDown, ...next.wordIndices],
            text: `${wordsGoingDown.map(wi => transcript[wi].text).join(' ')} ${next.text}`.trim(),
            start: splitBoundary, // next block now starts at cursor
            end: next.end,
          };

          const newGroups = [
            ...captionGroups.slice(0, index),
            updatedCurr,
            updatedNext,
            ...captionGroups.slice(index + 2),
          ];
          set({ captionGroups: newGroups, selectedGroupIndices: [index] });
        },

        // ── Selection ────────────────────────────────────────────────────
        selectGroup: (index, multi = false) => {
          const { selectedGroupIndices, captionGroups } = get();
          let newSelection = multi ? [...selectedGroupIndices] : [];

          const existingIdx = newSelection.indexOf(index);
          if (existingIdx >= 0) {
            newSelection = newSelection.filter(i => i !== index);
          } else {
            newSelection = [...newSelection, index];
          }

          newSelection = newSelection.filter(idx => idx >= 0 && idx < captionGroups.length);
          set({ selectedGroupIndices: newSelection });
        },

        clearSelection: () => set({ selectedGroupIndices: [] }),

        selectAll: () => {
          const { captionGroups } = get();
          set({ selectedGroupIndices: captionGroups.map((_, idx) => idx) });
        },

        // ── Smart Timing ─────────────────────────────────────────────────
        squeezeGaps: (maxGapSeconds = 0.1) => {
          const { captionGroups } = get();
          if (captionGroups.length < 2) return;
          pushUndo();

          const newGroups = [...captionGroups];
          for (let i = 0; i < newGroups.length - 1; i++) {
            const current = newGroups[i];
            const next = newGroups[i + 1];
            const gap = next.start - current.end;
            if (gap > 0 && gap <= maxGapSeconds) {
              const overlap = Math.min(gap * 0.5, 0.05);
              newGroups[i] = { ...current, end: next.start - overlap };
            }
          }
          set({ captionGroups: newGroups });
        },

        expandGaps: (minGapSeconds = 0.2) => {
          const { captionGroups } = get();
          if (captionGroups.length < 2) return;
          pushUndo();

          const newGroups = [...captionGroups];
          for (let i = 0; i < newGroups.length - 1; i++) {
            const current = newGroups[i];
            const next = newGroups[i + 1];
            const gap = next.start - current.end;
            if (gap < minGapSeconds) {
              newGroups[i + 1] = { ...next, start: current.end + minGapSeconds };
            }
          }
          set({ captionGroups: newGroups });
        },

        // ── Undo / Redo ───────────────────────────────────────────────────
        undoCaptions: () => {
          const { captionUndoStack, captionRedoStack, captionGroups } = get();
          if (captionUndoStack.length === 0) return;

          const previous = captionUndoStack[captionUndoStack.length - 1];
          const redoSnapshot: CaptionSnapshot = { captionGroups: [...captionGroups] };

          set({
            captionGroups: previous.captionGroups,
            captionUndoStack: captionUndoStack.slice(0, -1),
            captionRedoStack: [...captionRedoStack, redoSnapshot].slice(-MAX_UNDO_STEPS),
            selectedGroupIndices: [],
          });
        },

        redoCaptions: () => {
          const { captionRedoStack, captionUndoStack, captionGroups } = get();
          if (captionRedoStack.length === 0) return;

          const next = captionRedoStack[captionRedoStack.length - 1];
          const undoSnapshot: CaptionSnapshot = { captionGroups: [...captionGroups] };

          set({
            captionGroups: next.captionGroups,
            captionRedoStack: captionRedoStack.slice(0, -1),
            captionUndoStack: [...captionUndoStack, undoSnapshot].slice(-MAX_UNDO_STEPS),
            selectedGroupIndices: [],
          });
        },

        setEnhanceTier: (enhanceTier) => set({ enhanceTier }),
        setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
        setEnhanceProgress: (enhanceProgress) => set({ enhanceProgress }),
        setIsExporting: (isExporting) => set({ isExporting }),
        setExportProgress: (exportProgress) => set({ exportProgress }),
        setExportedUrl: (exportedUrl) => set({ exportedUrl }),

        resetProcessing: () => set({
          ...initialSession,
          enhanceTier: get().enhanceTier,
        }),
      };
    },
    {
      name: 'ordio-processing-preferences',
      partialize: (state) => ({
        enhanceTier: state.enhanceTier,
      }),
    }
  )
);
