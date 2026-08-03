'use client';

import { useCallback, useEffect } from 'react';
import { useCaptureStore, useProcessingStore, useHistoryStore } from '@/stores';
import type { HistoryEntry, HistorySnapshot } from '@/stores/historyStore';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { Word } from '@Ordio/shared/schemas';

interface UseExportHistoryArgs {
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
}

export interface UseExportHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  /** "Undo split caption" / "Undo" — for the button's accessible name. */
  undoLabel: string;
  redoLabel: string;
  undo: () => void;
  redo: () => void;
  /** Record the pre-cut audio + transcript before a trim commit replaces them. */
  pushTrim: (audioBuffer: AudioBuffer, transcript: Word[], label?: string) => void;
}

/**
 * Binds the unified history stack to the stores and the playback engine.
 *
 * The store holds snapshots but deliberately knows nothing about where they came
 * from. This hook is the half that does: it reads current state to bank a redo
 * entry, writes a restored snapshot back, and runs the side effects a plain
 * store write can't — reloading the playback buffer and resetting the trim
 * handles to the restored duration.
 */
export function useExportHistory({
  playback,
  trimmer,
}: UseExportHistoryArgs): UseExportHistoryReturn {
  const past = useHistoryStore((s) => s.past);
  const future = useHistoryStore((s) => s.future);

  /** Snapshot whatever the restored entry is about to overwrite, so the inverse
   *  direction has something to restore. Mirrors `applySnapshot` exactly. */
  const captureCurrent = useCallback((kind: HistorySnapshot['kind'], label: string): HistoryEntry => {
    if (kind === 'captions') {
      const processing = useProcessingStore.getState();
      return {
        label,
        snapshot: {
          kind: 'captions',
          captionGroups: processing.captionGroups,
          transcript: processing.transcript,
        },
      };
    }
    return {
      label,
      snapshot: {
        kind: 'trim',
        // Non-null by construction: a trim entry only exists because a buffer
        // was committed, and the buffer is never cleared while the screen lives.
        audioBuffer: useCaptureStore.getState().audioBuffer as AudioBuffer,
        transcript: useProcessingStore.getState().transcript ?? [],
      },
    };
  }, []);

  const applySnapshot = useCallback(
    (snapshot: HistorySnapshot) => {
      if (snapshot.kind === 'captions') {
        // Set directly rather than through setTranscript, which rebuilds the
        // grouping from scratch and would discard the splits being restored.
        useProcessingStore.setState({
          captionGroups: snapshot.captionGroups,
          transcript: snapshot.transcript,
          // The restored grouping may not contain the selected index.
          selectedGroupIndices: [],
        });
        return;
      }

      useCaptureStore.getState().setAudioBuffer(snapshot.audioBuffer);
      useProcessingStore.getState().setTranscript(snapshot.transcript);
      playback.load(snapshot.audioBuffer);
      trimmer.resetAll(snapshot.audioBuffer.duration);
    },
    [playback, trimmer]
  );

  const step = useCallback(
    (direction: 'undo' | 'redo') => {
      const store = useHistoryStore.getState();
      const stack = direction === 'undo' ? store.past : store.future;
      const target = stack[stack.length - 1];
      if (!target) return;

      const current = captureCurrent(target.snapshot.kind, target.label);
      const restored = direction === 'undo' ? store.undo(current) : store.redo(current);
      if (restored) applySnapshot(restored.snapshot);
    },
    [captureCurrent, applySnapshot]
  );

  const undo = useCallback(() => step('undo'), [step]);
  const redo = useCallback(() => step('redo'), [step]);

  // The standard chords, bound once against the unified history. These used to
  // live in useCaptionEditorShortcuts, where they could only reach caption
  // edits — pressing undo after a trim did nothing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;

      const tagName = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const pushTrim = useCallback(
    (audioBuffer: AudioBuffer, transcript: Word[], label = 'apply cuts') => {
      useHistoryStore.getState().push({ label, snapshot: { kind: 'trim', audioBuffer, transcript } });
    },
    []
  );

  const lastPast = past[past.length - 1];
  const lastFuture = future[future.length - 1];

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoLabel: lastPast ? `Undo ${lastPast.label}` : 'Undo',
    redoLabel: lastFuture ? `Redo ${lastFuture.label}` : 'Redo',
    undo,
    redo,
    pushTrim,
  };
}
