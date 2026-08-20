'use client';

/**
 * The desktop editor shell.
 *
 * Owns the reducer, the keyboard map, and the bridge between the editor's own
 * state and the app's real playback + session stores. Playback time is NOT
 * mirrored into desk state — `usePlayback` is the single clock, and every seek
 * goes through it, so the transport, timeline playhead and active-word
 * highlight can never disagree.
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { Word } from '@Ordio/shared';
import { buildSentenceSegments } from '@Ordio/engine/captions/display';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { useSessionHydration } from '@/hooks/session/useSessionHydration';
import { useProcessingStore } from '@/stores';
import {
  deskReducer,
  INITIAL_DESK_HISTORY,
  type DeskStore,
} from '@/lib/desktop/deskReducer';
import { INITIAL_DESK_STATE, type DeskState } from '@/lib/desktop/deskState';
import { DeskTopBar } from './DeskTopBar';
import { LeftPanel } from './LeftPanel';
import { PlayerStage } from './PlayerStage';
import { Transport } from './Transport';
import { ToolRail } from './ToolRail';
import { TimelineDeck } from './TimelineDeck';
import { InspectorPanel } from './inspector/InspectorPanel';
import { ExportSheet } from './sheets/ExportSheet';
import { ShortcutsSheet } from './sheets/ShortcutsSheet';
import { CommandPalette, type PaletteAction } from './sheets/CommandPalette';
import { TOOL_COPY, type ToolId } from '@/lib/desktop/deskCatalog';

const INITIAL_STORE: DeskStore = {
  state: INITIAL_DESK_STATE,
  history: INITIAL_DESK_HISTORY,
};

/** A gap between consecutive words long enough to be worth offering as a cut. */
const PAUSE_THRESHOLD = 0.45;

const FILLERS = new Set(['so', 'um', 'uh', 'like', 'okay', 'actually', 'basically']);

export function DeskShell() {
  const [store, dispatch] = useReducer(deskReducer, INITIAL_STORE);
  const { state, history } = store;

  const playback = usePlayback();
  useSessionHydration(state.clipId, playback);

  const transcript = useProcessingStore((s) => s.transcript);

  const patch = useCallback(
    (next: Partial<DeskState>, undoable = false) =>
      dispatch({ type: 'patch', patch: next, undoable }),
    []
  );

  /* Transcript arrives asynchronously after hydration — fold it in when it does. */
  useEffect(() => {
    if (!state.clipId || transcript.length === 0) return;
    const lines = buildSentenceSegments(transcript).map((segment) => ({
      start: segment.start,
      end: segment.end,
      words: segment.words,
    }));
    patch({ lines });
  }, [state.clipId, transcript, patch]);

  const words: Word[] = useMemo(
    () => state.lines.flatMap((l) => l.words),
    [state.lines]
  );

  const t = playback.currentTime;
  const duration = playback.duration || state.duration;

  const activeWordIndex = useMemo(
    () => words.findIndex((w) => t >= w.start && t < w.end),
    [words, t]
  );

  const pauses = useMemo(() => {
    const found: { at: number; len: number }[] = [];
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap >= PAUSE_THRESHOLD) {
        found.push({ at: +words[i - 1].end.toFixed(2), len: +gap.toFixed(2) });
      }
    }
    return found;
  }, [words]);

  const seek = useCallback((next: number) => playback.seek(next), [playback]);

  const togglePlay = useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else playback.play();
  }, [playback]);

  const jumpWord = useCallback(
    (direction: 1 | -1) => {
      const target =
        direction === 1
          ? words.find((w) => w.start > t + 0.01)
          : [...words].reverse().find((w) => w.start < t - 0.01);
      if (target) seek(target.start);
    },
    [words, t, seek]
  );

  /* Keyboard map, straight from the design's timeline hint strip. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      // A sheet owns the keyboard while it is open — otherwise space would
      // start playback behind the export dialog.
      if (state.sheet !== null) return;

      const step = e.shiftKey ? 1 : 0.25;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (meta && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        patch({ sheet: 'export' });
      } else if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        patch({ sheet: 'palette' });
      } else if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        patch({ findOpen: true });
      } else if (e.key === 'Escape') {
        patch({ cursor: null, editing: null });
      } else if (e.key === '[') {
        e.preventDefault();
        patch({ leftCollapsed: !state.leftCollapsed });
      } else if (e.key === ']') {
        e.preventDefault();
        patch({ inspectorCollapsed: !state.inspectorCollapsed });
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.altKey ? jumpWord(1) : seek(t + step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.altKey ? jumpWord(-1) : seek(t - step);
      } else if (e.key.toLowerCase() === 's') {
        dispatch({ type: 'splitRow' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // The collapse flags are read inside the handler, so they belong here —
    // without them a stale closure would toggle from the value at bind time
    // and the panel would flip back on the second press.
  }, [
    togglePlay,
    jumpWord,
    seek,
    t,
    patch,
    state.sheet,
    state.leftCollapsed,
    state.inspectorCollapsed,
  ]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(words.map((w) => w.text).join(' '));
    patch({ copied: true });
    window.setTimeout(() => patch({ copied: false }), 1600);
  }, [words, patch]);

  const autoHighlight = useCallback(() => {
    const strong = words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.text.length >= 6 && !FILLERS.has(w.text.toLowerCase()))
      .map(({ i }) => i);
    patch({ accents: strong }, true);
  }, [words, patch]);

  const paletteActions: PaletteAction[] = useMemo(() => {
    const tools = (Object.keys(TOOL_COPY) as ToolId[]).map((id) => ({
      id: `tool-${id}`,
      group: 'Tool',
      label: TOOL_COPY[id].title,
      run: () => patch({ tool: id }),
    }));

    return [
      ...tools,
      {
        id: 'play',
        group: 'Playback',
        label: playback.isPlaying ? 'Pause' : 'Play',
        keys: 'space',
        run: togglePlay,
      },
      { id: 'export', group: 'File', label: 'Export', keys: '⌘E', run: () => patch({ sheet: 'export' }) },
      { id: 'clips', group: 'File', label: 'Back to your clips', run: () => dispatch({ type: 'clearClip' }) },
      { id: 'find', group: 'Edit', label: 'Find and replace', keys: '⌘F', run: () => patch({ findOpen: true }) },
      { id: 'split', group: 'Edit', label: 'Split at the cursor', keys: 'S', run: () => dispatch({ type: 'splitRow' }) },
      { id: 'highlight', group: 'Edit', label: 'Auto-highlight the strong words', run: autoHighlight },
      { id: 'copy', group: 'Edit', label: 'Copy the transcript', run: handleCopy },
      { id: 'undo', group: 'Edit', label: 'Undo', keys: '⌘Z', run: () => dispatch({ type: 'undo' }) },
      {
        id: 'captions',
        group: 'View',
        label: state.capHidden ? 'Show captions' : 'Hide captions',
        run: () => patch({ capHidden: !state.capHidden }),
      },
      {
        id: 'safe',
        group: 'View',
        label: state.safeShow ? 'Hide safe zones' : 'Show safe zones',
        run: () => patch({ safeShow: !state.safeShow }),
      },
      { id: 'shortcuts', group: 'Help', label: 'Keyboard shortcuts', run: () => patch({ sheet: 'shortcuts' }) },
    ];
  }, [patch, playback.isPlaying, togglePlay, autoHighlight, handleCopy, state.capHidden, state.safeShow]);

  return (
    <div data-ord className="ord-shell">
      <DeskTopBar
        sourceLine={state.clipName ?? 'No clip selected'}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        canExport={words.length > 0}
        onSearch={() => patch({ sheet: 'palette' })}
        onShortcuts={() => patch({ sheet: 'shortcuts' })}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onExport={() => patch({ sheet: 'export' })}
      />

      <div className="ord-workrow">
        <LeftPanel
          mode={state.leftMode}
          clipName={state.clipName}
          onRecord={() => patch({ leftMode: 'media' })}
          onUpload={() => patch({ leftMode: 'media' })}
          onSelectClip={(clipId, clipName, durationMs) =>
            dispatch({
              type: 'selectClip',
              clipId,
              clipName,
              lines: [],
              duration: durationMs / 1000,
            })
          }
          onClearClip={() => dispatch({ type: 'clearClip' })}
          lines={state.lines}
          selRow={state.selRow}
          cursor={state.cursor}
          accents={state.accents}
          t={t}
          findOpen={state.findOpen}
          findText={state.findText}
          replaceWith={state.replaceWith}
          copied={state.copied}
          onSelectRow={(selRow) => {
            patch({ selRow, cursor: null, editing: null });
            const line = state.lines[selRow];
            if (line) seek(line.start);
          }}
          onSetCursor={(cursor) => patch({ cursor })}
          onToggleAccent={(index) => dispatch({ type: 'toggleAccent', index })}
          onToggleFind={() => patch({ findOpen: !state.findOpen })}
          onFindText={(findText) => patch({ findText })}
          onReplaceWith={(replaceWith) => patch({ replaceWith })}
          onReplaceAll={() => dispatch({ type: 'replaceAll' })}
          onAutoHighlight={autoHighlight}
          onSplit={() => dispatch({ type: 'splitRow' })}
          onMerge={(direction) => dispatch({ type: 'mergeRow', direction })}
          onCopy={handleCopy}
          onDelete={() => dispatch({ type: 'deleteRow', row: state.selRow })}
          editing={state.editing}
          onBeginEdit={(editing) => patch({ editing })}
          onCommitEdit={(index, text) => {
            dispatch({ type: 'editWord', row: state.selRow, index, text });
            patch({ editing: null });
          }}
          collapsed={state.leftCollapsed}
          onToggleCollapse={() => patch({ leftCollapsed: !state.leftCollapsed })}
        />

        <div className="ord-player">
          <PlayerStage
            state={state}
            words={words}
            activeWordIndex={activeWordIndex}
            onShowCaptions={() => patch({ capHidden: false })}
          />
          <Transport
            playing={playback.isPlaying}
            t={t}
            duration={duration}
            safeShow={state.safeShow}
            capHidden={state.capHidden}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onToggleSafe={() => patch({ safeShow: !state.safeShow })}
            onToggleCaptions={() => patch({ capHidden: !state.capHidden })}
          />
        </div>

        <InspectorPanel
          state={state}
          words={words}
          activeWordIndex={activeWordIndex}
          pauses={pauses}
          patch={patch}
          onNudgeWord={() => undefined}
          onResync={() => undefined}
          onCutAllPauses={() =>
            patch({ cutPauses: pauses.map((p) => p.at) }, true)
          }
          onRemoveFillers={() =>
            patch(
              {
                lines: state.lines.map((line) => ({
                  ...line,
                  words: line.words.filter(
                    (w) => !FILLERS.has(w.text.toLowerCase().replace(/[.,!?]/g, ''))
                  ),
                })),
              },
              true
            )
          }
          onResetTrim={() =>
            patch({ trimIn: 0, trimOut: 0, cutPauses: [] }, true)
          }
          onReroll={() => undefined}
          collapsed={state.inspectorCollapsed}
          onToggleCollapse={() =>
            patch({ inspectorCollapsed: !state.inspectorCollapsed })
          }
        />

        <ToolRail
          tool={state.tool}
          onSelect={(tool) => patch({ tool })}
          disabled={state.leftMode === 'media'}
        />
      </div>

      <TimelineDeck
        lines={state.lines}
        duration={duration}
        t={t}
        zoom={state.zoom}
        selRow={state.selRow}
        trimIn={state.trimIn}
        trimOut={state.trimOut}
        bedLabel={state.bed === 'none' ? 'No music bed' : state.bed}
        onSeek={seek}
        onSelectRow={(selRow) => {
          patch({ selRow, cursor: null, editing: null });
          const line = state.lines[selRow];
          if (line) seek(line.start);
        }}
        onZoom={(delta) =>
          patch({ zoom: Math.min(6, Math.max(1, state.zoom + delta)) })
        }
      />

      {state.sheet === 'export' && (
        <ExportSheet
          state={state}
          words={words}
          patch={patch}
          onClose={() => patch({ sheet: null, exStage: 'setup', exportPct: 0 })}
          onStart={() => patch({ exStage: 'running', exportPct: 0 })}
        />
      )}
      {state.sheet === 'shortcuts' && (
        <ShortcutsSheet onClose={() => patch({ sheet: null })} />
      )}
      {state.sheet === 'palette' && (
        <CommandPalette
          actions={paletteActions}
          onClose={() => patch({ sheet: null })}
        />
      )}
    </div>
  );
}
