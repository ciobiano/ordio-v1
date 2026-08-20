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
  | { type: 'nudgeWord'; index: number; delta: number }
  | { type: 'splitRow' }
  | { type: 'mergeRow'; direction: 'up' | 'down' }
  | { type: 'deleteRow'; row: number }
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

    /**
     * Shift one word's timing, so the highlight lands on the beat.
     *
     * The Timing panel has offered these buttons since it was written; the
     * shell handed it `() => undefined`, so every press did nothing. This is
     * the implementation behind them.
     *
     * `index` is a document-wide flat word index, matching how `accents` and
     * `activeWordIndex` already address words, so the panel does not need to
     * know which row a word is in.
     *
     * Neighbours are the clamp. A word dragged past the one before it would
     * make the transcript non-monotonic, and every consumer downstream —
     * active-word lookup, caption segmentation, the export renderer — assumes
     * start times only ever increase. Leaving a 1ms gap rather than allowing
     * equality keeps `t >= start && t < end` selecting exactly one word.
     */
    case 'nudgeWord': {
      const words = flatWords(s.lines);
      const word = words[action.index];
      if (!word) return store;

      const EPSILON = 0.001;
      const floor = (words[action.index - 1]?.end ?? 0) + EPSILON;
      /* No next word means the clip's end is the wall — and before hydration
         reports a duration, the word's own end plus a second stands in, so a
         nudge is never silently clamped to zero. */
      const ceiling =
        (words[action.index + 1]?.start ?? (s.duration || word.end + 1)) - EPSILON;
      const span = word.end - word.start;

      let start = word.start + action.delta;
      if (start < floor) start = floor;
      if (start + span > ceiling) start = ceiling - span;
      /* A word longer than the space between its neighbours cannot move. */
      if (start < floor) return store;
      if (Math.abs(start - word.start) < EPSILON) return store;

      const shift = start - word.start;
      let seen = 0;
      const lines = s.lines.map((line) => {
        const from = seen;
        seen += line.words.length;
        if (action.index < from || action.index >= seen) return line;
        const next = line.words.map((w, i) =>
          from + i === action.index
            ? { ...w, start: w.start + shift, end: w.end + shift }
            : w
        );
        /* The row's own bounds follow its words, or the timeline block and
           the caption it draws stop agreeing about when the line runs. */
        return {
          ...line,
          words: next,
          start: Math.min(...next.map((w) => w.start)),
          end: Math.max(...next.map((w) => w.end)),
        };
      });

      return commit(store, { ...s, lines });
    }

    case 'splitRow': {
      const row = s.lines[s.selRow];
      if (!row || row.words.length < 2) return store;

      /* No cursor placed? Split at the playhead, the way mobile does. The
         desktop previously just disabled the button, which meant a row you
         had not clicked into could not be split at all — the capability was
         there and unreachable. Falls back to the midpoint when the playhead
         sits outside this row. */
      const at =
        s.cursor ??
        (() => {
          const i = row.words.findIndex((w) => s.t >= w.start && s.t < w.end);
          return i > 0 ? i : Math.ceil(row.words.length / 2);
        })();
      if (at <= 0 || at >= row.words.length) return store;

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

    /**
     * Remove one caption row.
     *
     * Mobile has this and the desktop did not, which is the gap being closed.
     * Mobile's model does not transfer directly though: there, `transcript`
     * and `captionGroups` are two stores, so deleting a group drops the
     * caption while every word stays put and nothing after it shifts in time.
     * Here `lines` is the only store — the words and the grouping are the same
     * array — so what "delete" removes has to be decided rather than copied.
     *
     * Undo covers it either way, so it needs no confirm. Cutting audio is the
     * Trim panel's job and must not happen here.
     */
    case 'deleteRow': {
      const row = s.lines[action.row];
      if (!row || s.lines.length <= 1) return store;

      /* The words go with it.
         The alternative — keep the words and fold them into the neighbouring
         row — is what mobile's guarantee implies, but here it would just be
         Merge with a different label, and Merge is already the button next to
         this one. A control called Delete that does not delete is worse than
         one that does. The audio is untouched either way: that span plays with
         no caption over it. */
      const offset = s.lines
        .slice(0, action.row)
        .reduce((n, l) => n + l.words.length, 0);
      const removed = row.words.length;

      const lines = s.lines.filter((_, i) => i !== action.row);

      /* `accents` holds document-wide flat word indices, so removing words
         from the middle invalidates every index after them. Drop the ones
         inside the deleted span, shift the rest back. Missing this is the
         quiet kind of bug: emphasis silently lands on the wrong words. */
      const accents = s.accents
        .filter((i) => i < offset || i >= offset + removed)
        .map((i) => (i >= offset + removed ? i - removed : i));

      /* Word timings are absolute, so nothing after this moves in time and
         `cutPauses` stays valid. Only the selection needs rescuing — deleting
         the last row leaves selRow pointing past the end. */
      return commit(store, {
        ...s,
        lines,
        accents,
        selRow: Math.min(action.row, lines.length - 1),
        cursor: null,
        editing: null,
      });
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
