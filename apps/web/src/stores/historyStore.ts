'use client';

import { create } from 'zustand';
import type { Word } from '@Ordio/shared/schemas';
import type { CaptionGroup } from './types';

/**
 * One unified undo history for the export screen.
 *
 * Replaces the two stacks that used to run side by side — caption edits kept 50
 * steps inside processingStore, trim commits kept 5 steps of component state in
 * ExportState — each with its own button pair in its own panel. The redesign
 * puts a single pair in the transport bar, which only works if there is a single
 * ordered history behind it.
 *
 * This store is deliberately dependency-free: it holds snapshots and nothing
 * else, and never reads or writes the stores it restores into. Capturing the
 * current state and applying a restored one both live in `useExportHistory`,
 * which keeps this testable and avoids a cycle (processingStore pushes here, so
 * this importing processingStore back would be circular).
 */

export type HistorySnapshot =
  | { kind: 'captions'; captionGroups: CaptionGroup[] }
  | { kind: 'trim'; audioBuffer: AudioBuffer; transcript: Word[] };

export interface HistoryEntry {
  snapshot: HistorySnapshot;
  /** Verb phrase naming the action, e.g. "split caption". Used for aria-labels
   *  so the buttons read "Undo split caption" rather than a bare "Undo". */
  label: string;
}

/** Caption snapshots are a handful of small objects; trim snapshots carry a
 *  whole decoded AudioBuffer, which for a long recording is tens of megabytes.
 *  Two budgets rather than one, so cheap edits keep a deep history without a
 *  few expensive ones pinning that much audio in memory. */
const MAX_ENTRIES = 50;
const MAX_HEAVY_ENTRIES = 5;

const isHeavy = (entry: HistoryEntry) => entry.snapshot.kind === 'trim';

/**
 * Trim the oldest entries until both budgets are satisfied.
 *
 * Always drops from the oldest end, never from the middle: the stack is ordered
 * and removing an interior entry would make undo jump over a state the user
 * actually passed through. Dropping the oldest just shortens how far back they
 * can go, which is the honest failure mode.
 */
function withinBudget(entries: HistoryEntry[]): HistoryEntry[] {
  let dropped = 0;
  let heavy = entries.reduce((count, entry) => count + (isHeavy(entry) ? 1 : 0), 0);

  while (entries.length - dropped > MAX_ENTRIES || heavy > MAX_HEAVY_ENTRIES) {
    if (isHeavy(entries[dropped])) heavy -= 1;
    dropped += 1;
  }

  return dropped === 0 ? entries : entries.slice(dropped);
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];

  /** Record the state as it was *before* a mutation. Clears the redo branch. */
  push: (entry: HistoryEntry) => void;
  /** Hand back the previous state, banking `current` for redo. Null when empty. */
  undo: (current: HistoryEntry) => HistoryEntry | null;
  /** Hand back the next state, banking `current` for undo. Null when empty. */
  redo: (current: HistoryEntry) => HistoryEntry | null;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  push: (entry) =>
    set((state) => ({
      past: withinBudget([...state.past, entry]),
      // A new action after undoing abandons the redo branch, so those snapshots
      // are released rather than held for a future that can no longer happen.
      future: [],
    })),

  undo: (current) => {
    const { past, future } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: withinBudget([...future, current]),
    });
    return previous;
  },

  redo: (current) => {
    const { past, future } = get();
    if (future.length === 0) return null;

    const next = future[future.length - 1];
    set({
      past: withinBudget([...past, current]),
      future: future.slice(0, -1),
    });
    return next;
  },

  clearHistory: () => set({ past: [], future: [] }),
}));
