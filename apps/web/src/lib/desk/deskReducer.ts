/**
 * Desktop editor reducer.
 *
 * Undo tracks *document* edits — transcript text, row structure, emphasis and
 * caption styling. It deliberately does not track playhead, zoom, which tool
 * is open or which sheet is showing: undoing a scrub is not what ⌘Z means to
 * anyone, and recording it would bury the real edits under noise.
 */

import type { Word } from '@Ordio/shared';
import { INITIAL_DESK_STATE, type DeskLine, type DeskState } from './deskState';

const HISTORY_LIMIT = 50;

/** The slice ⌘Z restores. */
type Snapshot = Pick<
  DeskState,
  'lines' | 'accents' | 'preset' | 'font' | 'fontSize' | 'anim' | 'capCase' | 'trimIn' | 'trimOut' | 'cutPauses'
>;

export interface DeskHistory {
  past: Snapshot[];
  future: Snapshot[];
}

export const INITIAL_DESK_HISTORY: DeskHistory = { past: [], future: [] };

export type DeskAction =
  | { type: 'patch'; patch: Partial<DeskState>; undoable?: boolean }
  | { type: 'selectClip'; clipId: string; clipName: string; lines: DeskLine[]; duration: number }
  | { type: 'clearClip' }
  | { type: 'seek'; t: number }
  | { type: 'nudge'; by: number }
  | { type: 'jumpWord'; direction: 1 | -1 }
  | { type: 'toggleAccent'; index: number }
  | { type: 'editWord'; row: number; index: number; text: string }
  | { type: 'splitRow' }
  | { type: 'mergeRow'; direction: 'up' | 'down' }
  | { type: 'replaceAll' }
  | { type: 'undo' }
  | { type: 'redo' };

function snapshot(s: DeskState): Snapshot {
  return {
    lines: s.lines,
    accents: s.accents,
    preset: s.preset,
    font: s.font,
    fontSize: s.fontSize,
    anim: s.anim,
    capCase: s.capCase,
    trimIn: s.trimIn,
    trimOut: s.trimOut,
    cutPauses: s.cutPauses,
  };
}

export interface DeskStore {
  state: DeskState;
  history: DeskHistory;
}

/** Push the pre-edit snapshot onto `past` and drop any redo branch. */
function commit(store: DeskStore, next: DeskState): DeskStore {
  return {
    state: next,
    history: {
      past: [...store.history.past, snapshot(store.state)].slice(-HISTORY_LIMIT),
      future: [],
    },
  };
}

function flatWords(lines: DeskLine[]): Word[] {
  return lines.flatMap((l) => l.words);
}

export function deskReducer(store: DeskStore, action: DeskAction): DeskStore {
  const s = store.state;

  switch (action.type) {
    case 'patch': {
      const next = { ...s, ...action.patch };
      return action.undoable ? commit(store, next) : { ...store, state: next };
    }

    case 'selectClip':
      return {
        state: {
          ...s,
          leftMode: 'transcript',
          clipId: action.clipId,
          clipName: action.clipName,
          lines: action.lines,
          duration: action.duration,
          t: 0,
          selRow: 0,
          cursor: null,
          accents: [],
          trimIn: 0,
          trimOut: 0,
          cutPauses: [],
          playing: false,
        },
        history: INITIAL_DESK_HISTORY,
      };

    case 'clearClip':
      return {
        state: { ...INITIAL_DESK_STATE, leftMode: 'media' },
        history: INITIAL_DESK_HISTORY,
      };

    case 'seek':
      return {
        ...store,
        state: { ...s, t: Math.min(s.duration, Math.max(0, action.t)) },
      };

    case 'nudge':
      return {
        ...store,
        state: { ...s, t: Math.min(s.duration, Math.max(0, s.t + action.by)) },
      };

    case 'jumpWord': {
      const words = flatWords(s.lines);
      if (words.length === 0) return store;
      const target =
        action.direction === 1
          ? words.find((w) => w.start > s.t + 0.01)
          : [...words].reverse().find((w) => w.start < s.t - 0.01);
      return target ? { ...store, state: { ...s, t: target.start } } : store;
    }

    case 'toggleAccent': {
      const has = s.accents.includes(action.index);
      const accents = has
        ? s.accents.filter((i) => i !== action.index)
        : [...s.accents, action.index];
      return commit(store, { ...s, accents });
    }

    case 'editWord': {
      const lines = s.lines.map((line, row) =>
        row !== action.row
          ? line
          : {
              ...line,
              words: line.words.map((w, i) =>
                i === action.index ? { ...w, text: action.text } : w
              ),
            }
      );
      return commit(store, { ...s, lines, editing: null });
    }

    case 'splitRow': {
      const at = s.cursor;
      const row = s.lines[s.selRow];
      if (at === null || !row || at <= 0 || at >= row.words.length) return store;

      const head = row.words.slice(0, at);
      const tail = row.words.slice(at);
      const lines = [
        ...s.lines.slice(0, s.selRow),
        { start: row.start, end: head[head.length - 1].end, words: head },
        { start: tail[0].start, end: row.end, words: tail },
        ...s.lines.slice(s.selRow + 1),
      ];
      return commit(store, { ...s, lines, cursor: null });
    }

    case 'mergeRow': {
      const target = action.direction === 'up' ? s.selRow - 1 : s.selRow;
      const a = s.lines[target];
      const b = s.lines[target + 1];
      if (!a || !b) return store;

      const merged = { start: a.start, end: b.end, words: [...a.words, ...b.words] };
      const lines = [
        ...s.lines.slice(0, target),
        merged,
        ...s.lines.slice(target + 2),
      ];
      return commit(store, { ...s, lines, selRow: target, cursor: null });
    }

    case 'replaceAll': {
      const find = s.findText.trim().toLowerCase();
      if (!find) return store;
      const lines = s.lines.map((line) => ({
        ...line,
        words: line.words.map((w) =>
          w.text.toLowerCase() === find ? { ...w, text: s.replaceWith } : w
        ),
      }));
      return commit(store, { ...s, lines });
    }

    case 'undo': {
      const previous = store.history.past[store.history.past.length - 1];
      if (!previous) return store;
      return {
        state: { ...s, ...previous },
        history: {
          past: store.history.past.slice(0, -1),
          future: [snapshot(s), ...store.history.future].slice(0, HISTORY_LIMIT),
        },
      };
    }

    case 'redo': {
      const [next, ...rest] = store.history.future;
      if (!next) return store;
      return {
        state: { ...s, ...next },
        history: {
          past: [...store.history.past, snapshot(s)].slice(-HISTORY_LIMIT),
          future: rest,
        },
      };
    }
  }
}
