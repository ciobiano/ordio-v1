'use client';

/**
 * The desktop editor shell.
 *
 * Owns the reducer, the keyboard map, the capture flow, and the bridge between
 * the editor's own state and the app's real playback + session stores.
 *
 * Two clocks would be two sources of truth, so there is one of each: playback
 * time is NOT mirrored into desk state — `usePlayback` is the single clock and
 * every seek goes through it — and the capture phase is derived by the same
 * pure function mobile uses, never re-implemented here.
 *
 * The stage in the middle morphs. Before a clip exists it is the capture
 * surface (orb, captions, progress); once one does it is the preview canvas.
 * Everything around it — top bar, clips list, tool strip, timeline — stays
 * mounted throughout, because all of it is still true while you record.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Word } from '@Ordio/shared';
import { buildSentenceSegments } from '@Ordio/engine/captions/display';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { useDeskStyleSync } from '@/lib/desktop/useDeskStyleSync';
import { useDeskTrimCommit } from '@/lib/desktop/useDeskTrimCommit';
import { useSessionHydration } from '@/hooks/session/useSessionHydration';
import { useCreateFlow } from '@/hooks/recording/useCreateFlow';
import { useCaptureStore, useProcessingStore } from '@/stores';
import { deriveCapturePhase } from '@/lib/capture/phase';
import type { CapturePhase, RecordingSubPhase } from '@/lib/capture/types';
import { FILE_ACCEPT_ATTRIBUTE } from '@/lib/fileValidation';
import { bedFromDrop, type BedClip } from '@/lib/audio/bedGeometry';
import { readBedSource, type BedSource } from '@/lib/audio/bedPeaks';
import { useBedMix } from '@/hooks/audio/useBedMix';
import {
  deskReducer,
  INITIAL_DESK_HISTORY,
  type DeskStore,
} from '@/lib/desktop/deskReducer';
import { INITIAL_DESK_STATE, type DeskState } from '@/lib/desktop/deskState';
import { DeskTopBar } from './DeskTopBar';
import { LeftPanel } from './LeftPanel';
import { PlayerStage } from './PlayerStage';
import { DeskCaptureStage } from './stage/DeskCaptureStage';
import { DeskTransport } from './DeskTransport';
import { ToolStrip } from './tools/ToolStrip';
import { ToolPanel } from './tools/ToolPanel';
import { TimelineDeck } from './TimelineDeck';
import { ExportSheet } from './sheets/ExportSheet';
import { DeskSettingsSheet } from './sheets/DeskSettingsSheet';
import {
  DeskClipPicker,
  DeskEpisodeError,
  DeskEpisodeProgress,
  DeskFileConfirm,
  DeskProcessingAlert,
} from './sheets/DeskUploadSheets';
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

/** Held past this on release, a press that started from idle finishes the take. */
const PRESS_AUTO_FINISH_MS = 350;

export function DeskShell() {
  const [store, dispatch] = useReducer(deskReducer, INITIAL_STORE);
  const { state, history } = store;

  const playback = usePlayback();
  /* Every desk edit lands in the store the renderer reads, immediately —
     rather than only at the moment Export is pressed, which is what let the
     canvas and the encoded file disagree. */
  useDeskStyleSync(state);
  useSessionHydration(state.clipId, playback);

  const transcript = useProcessingStore((s) => s.transcript);

  const patch = useCallback(
    (next: Partial<DeskState>, undoable = false) =>
      dispatch({ type: 'patch', patch: next, undoable }),
    []
  );

  /* ── Capture ──────────────────────────────────────────────────────
     The desk gets its own instance of the same hook the mobile chrome
     mounts. Only one viewport branch is ever rendered (see /create), so
     there is never a second recorder competing for the microphone. */

  const selectSession = useCallback((sessionId: string) => {
    /* Processing resolves *into* the stage rather than navigating: on desktop
       the editor is already on screen, so pushing a route would tear down the
       shell and rebuild it around the clip that was just made here. The name
       and duration arrive with hydration; lines follow from the transcript. */
    dispatch({
      type: 'selectClip',
      clipId: sessionId,
      clipName: 'Untitled clip',
      lines: [],
      duration: 0,
    });
  }, []);

  const flow = useCreateFlow({ onSessionReady: selectSession });

  const [recordingSubPhase, setRecordingSubPhase] =
    useState<RecordingSubPhase>('recording');
  const [elapsed, setElapsed] = useState(0);

  const capturePhase: CapturePhase = deriveCapturePhase({
    currentState: flow.currentState,
    recordingSubPhase,
    isPaused: flow.recorder.isPaused,
  });

  /* A clip beats any capture phase: once one is loaded the stage is the
     editor, even if a stale phase were still sitting in the store. */
  const editing = state.clipId !== null;
  const stagePhase: CapturePhase | null = editing ? null : capturePhase;

  /* Elapsed time is the desk's own readout — mobile shows none, but a desktop
     recording session is long enough that "how long have I been talking" is a
     real question. Runs only while the recorder does. */
  useEffect(() => {
    if (capturePhase !== 'recording') return;
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [capturePhase]);

  useEffect(() => {
    if (flow.currentState === 'idle') setElapsed(0);
  }, [flow.currentState]);

  /* ── The music bed ────────────────────────────────────────────────
     Peaks live here rather than in desk state: they are derived from the
     dropped file, cost a full decode to produce, and would be snapshotted
     into every undo entry alongside the trim they describe. */
  const [bedSource, setBedSource] = useState<BedSource | null>(null);
  const [bedLoading, setBedLoading] = useState(false);

  const handleDropBed = useCallback(
    async (file: File, atSecond: number) => {
      setBedLoading(true);
      try {
        const source = await readBedSource(file);
        const url = URL.createObjectURL(file);
        setBedSource(source);
        patch(
          { bed: bedFromDrop(file.name, url, source.duration, atSecond) },
          true
        );
      } catch (err) {
        console.error('[DeskShell] bed decode', err);
        toast.error(`${file.name} could not be read as audio.`);
      } finally {
        setBedLoading(false);
      }
    },
    [patch]
  );

  /* Dragging fires continuously, so the moving value is not undoable — one
     entry is pushed when the pointer is released instead of sixty. */
  const handleChangeBed = useCallback(
    (next: BedClip) => patch({ bed: next }),
    [patch]
  );
  const handleCommitBed = useCallback(() => patch({}, true), [patch]);

  const handleRemoveBed = useCallback(() => {
    /* The object URL is the only thing here the browser will not reclaim on
       its own — every dropped file leaks a decoded copy without this. */
    if (state.bed) URL.revokeObjectURL(state.bed.url);
    setBedSource(null);
    patch({ bed: null }, true);
  }, [state.bed, patch]);

  const pressStartedAt = useRef(0);
  const pressActive = useRef(false);

  const handlePressStart = useCallback(() => {
    if (capturePhase !== 'idle') return;
    pressActive.current = true;
    pressStartedAt.current = Date.now();
    setRecordingSubPhase('recording');
    setElapsed(0);
    void flow.handleStartRecording();
  }, [capturePhase, flow]);

  const handleGoReady = useCallback(() => {
    setRecordingSubPhase('stopped');
    flow.handleStopRecording();
  }, [flow]);

  /* A press held past the threshold finishes the take on release; a plain tap
     leaves it running. Same shortcut mobile offers, same threshold. */
  const handlePressEnd = useCallback(() => {
    if (!pressActive.current) return;
    pressActive.current = false;
    if (Date.now() - pressStartedAt.current > PRESS_AUTO_FINISH_MS) handleGoReady();
  }, [handleGoReady]);

  const handleCancelCapture = useCallback(() => {
    setRecordingSubPhase('recording');
    setElapsed(0);
    flow.handleReset();
  }, [flow]);

  const handleRestartCapture = useCallback(() => {
    setRecordingSubPhase('recording');
    setElapsed(0);
    void flow.handleRestart();
  }, [flow]);

  /* ── Transcript ──────────────────────────────────────────────────── */

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

  /* Trim is pending until Apply, and Apply rewrites the audio and transcript
     together — see `useDeskTrimCommit`. The handles used to write two numbers
     that shaded the timeline and nothing else. */
  const trim = useDeskTrimCommit({
    state,
    words,
    duration,
    pauses,
    patch,
    onCommitted: (buffer) => playback.load(buffer),
  });

  const seek = useCallback((next: number) => playback.seek(next), [playback]);

  /* ── Preview hears the mix ────────────────────────────────────────
     The same buffer the exporter will encode, so the bed cannot sound one way
     in the editor and another in the file. */
  const { mixed } = useBedMix({
    bed: state.bed,
    voiceLevel: state.voiceLevel,
    musicLevel: state.musicLevel,
    duck: state.duck,
    words,
  });

  const setMixedBuffer = useCaptureStore((s) => s.setMixedBuffer);

  const wasPlaying = useRef(false);
  useEffect(() => {
    if (!mixed) return;
    /* Hand the same buffer to the exporter. Preview and export therefore
       cannot disagree: there is one mix, and both consume it. */
    setMixedBuffer(mixed);
    /* Swapping the buffer restarts playback from zero, so the position is
       carried across by hand. Without this, nudging the music level would
       throw you back to the top of the clip every time. */
    const at = playback.currentTime;
    wasPlaying.current = playback.isPlaying;
    playback.load(mixed);
    if (at > 0) playback.seek(at);
    if (wasPlaying.current) void playback.play();
    // Only a new mix should reload; playback identity changes every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixed]);

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

  /* ── Tools ───────────────────────────────────────────────────────── */

  const toggleTool = useCallback(
    (next: ToolId) =>
      patch(
        state.toolOpen && state.tool === next
          ? { toolOpen: false }
          : { tool: next, toolOpen: true }
      ),
    [patch, state.toolOpen, state.tool]
  );

  const openTool = useCallback(
    (next: ToolId) => patch({ tool: next, toolOpen: true }),
    [patch]
  );

  /* ── Timing ──────────────────────────────────────────────────────── */

  const nudgeWord = useCallback(
    (index: number, delta: number) => dispatch({ type: 'nudgeWord', index, delta }),
    []
  );

  /**
   * Throw away every manual nudge and rebuild from what Whisper returned.
   *
   * `transcript` in the processing store is the authoritative pass and is
   * never written back to, so it is still the original timing however much
   * the rows here have been edited. Undoable, because discarding an
   * afternoon of nudges by accident should cost one ⌘Z.
   */
  const resync = useCallback(() => {
    if (transcript.length === 0) return;
    const lines = buildSentenceSegments(transcript).map((segment) => ({
      start: segment.start,
      end: segment.end,
      words: segment.words,
    }));
    patch({ lines }, true);
  }, [transcript, patch]);

  /* ── Keyboard ────────────────────────────────────────────────────── */

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
        /* Escape closes the tool panel first, then clears the selection.
           Closing both at once would take away a panel the user may not have
           meant to lose along with a cursor they did. */
        if (state.toolOpen) patch({ toolOpen: false });
        else patch({ cursor: null, editing: null });
      } else if (e.key === '[') {
        e.preventDefault();
        patch({ leftCollapsed: !state.leftCollapsed });
      } else if (e.key === ']') {
        e.preventDefault();
        patch({ toolOpen: !state.toolOpen });
      } else if (e.code === 'Space') {
        e.preventDefault();
        /* Space is press-to-record until a clip exists, and play/pause after —
           the stage decides what the key means, the same way the transport
           does. Without this, space did nothing at all during capture. */
        if (!editing && capturePhase === 'idle') handlePressStart();
        else if (!editing && capturePhase === 'recording') flow.handlePauseRecording();
        else if (!editing && capturePhase === 'paused') flow.handleResumeRecording();
        else togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.altKey) jumpWord(1);
        else seek(t + step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.altKey) jumpWord(-1);
        else seek(t - step);
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
    state.toolOpen,
    editing,
    capturePhase,
    handlePressStart,
    flow,
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
      run: () => openTool(id),
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
      { id: 'record', group: 'File', label: 'Record a new clip', run: () => dispatch({ type: 'clearClip' }) },
      { id: 'clips', group: 'File', label: 'Back to your clips', run: () => dispatch({ type: 'clearClip' }) },
      { id: 'find', group: 'Edit', label: 'Find and replace', keys: '⌘F', run: () => patch({ findOpen: true }) },
      { id: 'split', group: 'Edit', label: 'Split at the cursor', keys: 'S', run: () => dispatch({ type: 'splitRow' }) },
      { id: 'highlight', group: 'Edit', label: 'Auto-highlight the strong words', run: autoHighlight },
      { id: 'resync', group: 'Edit', label: 'Re-sync every word', run: resync },
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
  }, [
    patch,
    openTool,
    playback.isPlaying,
    togglePlay,
    autoHighlight,
    resync,
    handleCopy,
    state.capHidden,
    state.safeShow,
  ]);

  return (
    <div data-ord className="ord-shell">
      <DeskTopBar
        clipName={state.clipName}
        format={state.format}
        canReframe={editing}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        canExport={words.length > 0}
        onFormat={(format) => patch({ format })}
        onClips={() => dispatch({ type: 'clearClip' })}
        onSearch={() => patch({ sheet: 'palette' })}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onExport={() => patch({ sheet: 'export' })}
      />

      <div className="ord-workrow">
        <LeftPanel
          mode={state.leftMode}
          clipName={state.clipName}
          /* Record and Upload are the two ways in, and they live here — the
             capture stage carries no duplicate of them. */
          onRecord={handlePressStart}
          onUpload={() => flow.fileInputRef.current?.click()}
          onOpenSettings={() => patch({ sheet: 'settings' })}
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
          {stagePhase === null ? (
            <PlayerStage
              state={state}
              playback={playback}
              onShowCaptions={() => patch({ capHidden: false })}
              onLocked={flow.setUpgradeTarget}
            />
          ) : (
            <DeskCaptureStage
              phase={stagePhase}
              audioLevel={flow.audioLevel}
              isSpeaking={flow.isSpeaking}
              micDenied={flow.micDenied}
              startError={flow.startError}
              canRecord={flow.capabilities.canRecord}
              isStarting={flow.isStarting}
              processingProgress={flow.processingProgress}
              committedCaptionLines={flow.committedCaptionLines}
              interimCaptionText={flow.interimCaptionText}
              elapsedLabel={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
            />
          )}

          <DeskTransport
            phase={stagePhase}
            processingProgress={flow.processingProgress}
            onStop={handleGoReady}
            onPause={flow.handlePauseRecording}
            onResume={flow.handleResumeRecording}
            onRestart={handleRestartCapture}
            onProcess={flow.handleProceed}
            onCancel={handleCancelCapture}
            onOpenSettings={() => patch({ sheet: 'settings' })}
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

          {/* The strip floats over the stage's right edge; the tool it opens
              docks as its own card beside the stage (below). */}
          <div className="ord-toolwrap">
            <ToolStrip
              tool={state.tool}
              open={state.toolOpen && editing}
              /* Nothing to style until there is a clip. */
              disabled={!editing}
              onToggle={toggleTool}
            />
          </div>
        </div>

        {state.toolOpen && editing && (
          <ToolPanel
            state={state}
            words={words}
            activeWordIndex={activeWordIndex}
            pauses={pauses}
            patch={patch}
            onClose={() => patch({ toolOpen: false })}
            onNudgeWord={nudgeWord}
            onResync={resync}
            onCutAllPauses={() => patch({ cutPauses: pauses.map((p) => p.at) }, true)}
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
            onResetTrim={() => patch({ trimIn: 0, trimOut: 0, cutPauses: [] }, true)}
            onApplyTrim={trim.commit}
            onLocked={flow.setUpgradeTarget}
            hasPendingCuts={trim.hasPendingCuts}
          />
        )}
      </div>

      <TimelineDeck
        lines={state.lines}
        duration={duration}
        t={t}
        zoom={state.zoom}
        selRow={state.selRow}
        trimIn={state.trimIn}
        trimOut={state.trimOut}
        bed={state.bed}
        bedSource={bedSource}
        bedLoading={bedLoading}
        onDropBed={handleDropBed}
        onChangeBed={handleChangeBed}
        onCommitBed={handleCommitBed}
        onRemoveBed={handleRemoveBed}
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

      {/* The one file input for the desk. The left panel's Upload opens it;
          long files route themselves to the episode pipeline inside the flow. */}
      <input
        ref={flow.fileInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={flow.handleFileSelect}
      />

      {state.sheet === 'settings' && (
        <DeskSettingsSheet
          onClose={() => patch({ sheet: null })}
          onLocked={flow.setUpgradeTarget}
        />
      )}
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

      {/* The upload path, which had no surfaces on the desk at all. Choosing
          a file started the pipeline and nothing rendered its states: a short
          file staged and waited on a confirmation that was never drawn, and a
          long one ingested behind a toast and appeared to hang. */}
      {flow.stagedFile && (
        <DeskFileConfirm
          file={flow.stagedFile}
          onConfirm={flow.handleFileConfirm}
          onCancel={() => flow.setStagedFile(null)}
        />
      )}

      {(flow.episode.phase === 'ingesting' ||
        flow.episode.phase === 'transcribing' ||
        flow.episode.phase === 'finding') && (
        <DeskEpisodeProgress
          phase={flow.episode.phase}
          progress={flow.episode.progress}
          onCancel={flow.episode.cancel}
        />
      )}

      {flow.episode.phase === 'picking' && (
        <DeskClipPicker
          candidates={flow.episode.candidates}
          episodeFile={flow.episode.episodeFile}
          episodeWords={flow.episode.episodeWords}
          onClose={flow.episode.cancel}
          onPicked={(sessionId) => {
            /* The clip opens on this desk rather than navigating, the same
               way a recording does — the editor is already on screen. */
            flow.episode.cancel();
            selectSession(sessionId);
          }}
        />
      )}

      {flow.episode.phase === 'error' && (
        <DeskEpisodeError
          message={flow.episode.error ?? 'Something went wrong.'}
          partialAvailable={flow.episode.partialAvailable}
          onUsePartial={flow.episode.usePartialTranscript}
          onDismiss={flow.episode.cancel}
        />
      )}

      {flow.processingAlert && (
        <DeskProcessingAlert
          alert={flow.processingAlert}
          onDisableEnhancement={flow.handleDisableEnhancement}
          onDismiss={flow.dismissAlert}
        />
      )}

      {/* Announced, not drawn — the stage is visual, and a screen reader user
          needs the phase change said out loud. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {capturePhase === 'recording' && 'Recording'}
        {capturePhase === 'paused' && 'Recording paused'}
        {capturePhase === 'ready' && 'Take captured, ready to process'}
        {capturePhase === 'processing' && 'Processing audio'}
      </div>
    </div>
  );
}
