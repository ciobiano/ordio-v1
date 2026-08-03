'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word } from '@Ordio/shared/schemas';
import { buildSmartSegments } from '@Ordio/engine/captions/segmentation';
import { buildSegmentsForMode, type BreakOptions } from '@Ordio/engine/captions/breaks';
import { useHistoryStore } from './historyStore';
import type { TranscriptionSource, EnhanceTier, CaptionGroup } from './types';

const INITIAL_PHRASE_SEGMENT_OPTIONS = {
  maxWords: 7,
  maxChars: 38,
  maxDuration: 1.9,
  minWords: 2,
};

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
  return buildSmartSegments(words, INITIAL_PHRASE_SEGMENT_OPTIONS).map((segment) => ({
    wordIndices: Array.from(
      { length: segment.endIndex - segment.startIndex },
      (_, index) => segment.startIndex + index
    ),
    text: segment.text,
    // start/end are timeline block boundaries, not derived per-word
    start: segment.start,
    end: segment.end,
  }));
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

  /**
   * Re-cut captions under a break rule.
   *
   * `scope` is 'all' to re-cut the whole transcript, or a group index to re-cut
   * just that caption — which is what the Breaks tab's "Apply to all phrases"
   * toggle switches between. Both discard any manual splits or merges inside
   * the scope, and both are undoable.
   */
  resegmentCaptions: (options: BreakOptions, scope: 'all' | number) => void;

  /**
   * Toggle whether the word at `positionInGroup` (a position within the
   * group's wordIndices, not a raw transcript index) is rendered with the
   * active caption style's accent treatment. Not undo-tracked — a stylistic
   * toggle, not a structural transcript edit.
   */
  toggleAccentWord: (groupIndex: number, positionInGroup: number) => void;

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

      /**
       * Snapshot current groups onto the shared history before a mutation.
       *
       * Caption edits and trim commits used to keep separate stacks with
       * separate buttons; both now feed `historyStore` so the transport bar's
       * single undo pair walks back through them in the order they happened.
       * `label` completes the sentence "Undo …" on that button.
       */
      function pushUndo(label: string) {
        useHistoryStore.getState().push({
          label,
          snapshot: { kind: 'captions', captionGroups: [...get().captionGroups] },
        });
      }

      return {
        ...initialPersisted,
        ...initialSession,

        setTranscript: (transcript) => {
          const groups = buildInitialGroups(transcript);
          set({
            transcript,
            captionGroups: groups,
            selectedGroupIndices: [],
          });
          useHistoryStore.getState().clearHistory();
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

          pushUndo('split caption');

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
          pushUndo('merge captions');
          const newGroups = mergeTwoGroupsImmutable(captionGroups, index, 'down');
          set({ captionGroups: newGroups, selectedGroupIndices: [] });
        },

        // ── Merge Up (CapCut "merge with previous") ──────────────────────
        mergeUp: (index) => {
          const { captionGroups } = get();
          if (index <= 0 || index >= captionGroups.length) return;
          pushUndo('merge captions');
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

          pushUndo('merge captions');

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

          pushUndo('merge captions');

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

        // ── Accent word toggle (script-accent, word-pop, big-statement styles) ──
        toggleAccentWord: (groupIndex, positionInGroup) => {
          const { captionGroups } = get();
          if (groupIndex < 0 || groupIndex >= captionGroups.length) return;

          const group = captionGroups[groupIndex];
          if (positionInGroup < 0 || positionInGroup >= group.wordIndices.length) return;

          const current = group.accentWordIndices ?? [];
          const nextAccent = current.includes(positionInGroup)
            ? current.filter((i) => i !== positionInGroup)
            : [...current, positionInGroup];

          const newGroups = [...captionGroups];
          newGroups[groupIndex] = { ...group, accentWordIndices: nextAccent };
          set({ captionGroups: newGroups });
        },

        // ── Selection ────────────────────────────────────────────────────
        resegmentCaptions: (options, scope) => {
          const { transcript, captionGroups } = get();
          if (transcript.length === 0) return;

          if (scope === 'all') {
            pushUndo('change breaks');
            set({
              captionGroups: buildSegmentsForMode(transcript, options).map((segment) => ({
                wordIndices: Array.from(
                  { length: segment.endIndex - segment.startIndex },
                  (_, i) => segment.startIndex + i
                ),
                text: segment.text,
                start: segment.start,
                end: segment.end,
              })),
              selectedGroupIndices: [],
            });
            return;
          }

          const group = captionGroups[scope];
          if (!group) return;

          // Re-cut the group's own words. Segment indices come back relative to
          // the slice, so they map through wordIndices to reach the transcript.
          const words = group.wordIndices.map((i) => transcript[i]).filter(Boolean);
          if (words.length === 0) return;

          const replacement = buildSegmentsForMode(words, options).map((segment) => ({
            wordIndices: group.wordIndices.slice(segment.startIndex, segment.endIndex),
            text: segment.text,
            start: segment.start,
            end: segment.end,
          }));
          if (replacement.length === 0) return;

          pushUndo('change breaks');
          set({
            captionGroups: [
              ...captionGroups.slice(0, scope),
              ...replacement,
              ...captionGroups.slice(scope + 1),
            ],
            selectedGroupIndices: [],
          });
        },

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
          pushUndo('squeeze gaps');

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
          pushUndo('expand gaps');

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

        setEnhanceTier: (enhanceTier) => set({ enhanceTier }),
        setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
        setEnhanceProgress: (enhanceProgress) => set({ enhanceProgress }),
        setIsExporting: (isExporting) => set({ isExporting }),
        setExportProgress: (exportProgress) => set({ exportProgress }),
        setExportedUrl: (exportedUrl) => set({ exportedUrl }),

        resetProcessing: () => {
          set({ ...initialSession, enhanceTier: get().enhanceTier });
          useHistoryStore.getState().clearHistory();
        },
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
