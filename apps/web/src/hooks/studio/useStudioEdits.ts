'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAudioTrimmer, type UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import { useCaptureStore, useProcessingStore } from '@/stores';
import type { Word } from '@Ordio/shared/schemas';

export interface CutRange {
  start: number;
  end: number;
}

interface PlaybackLoader {
  load: (buffer: AudioBuffer) => void;
}

interface EditSnapshot {
  audioBuffer: AudioBuffer;
  transcript: Word[];
}

export interface UseStudioEditsReturn {
  /** The real trimmer instance — same object mobile's TrimPanel drives directly. */
  trimmer: UseAudioTrimmerReturn;
  /** Pending cuts (word deletions + silence ranges + head/tail trim) as merged time ranges, for the timeline. */
  cutRanges: CutRange[];
  markFillerWords: () => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 5;
/** Filler tokens Descript-style cleanup removes. Punctuation-tolerant. */
const FILLER_PATTERN = /^(um+|uh+|uhm+|erm+|hmm+|mm+|ah+|er+)[,.!?…]?$/i;

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  });
  channels.forEach((channel, i) =>
    buffer.copyToChannel(
      new Float32Array(channel.buffer as ArrayBuffer, channel.byteOffset, channel.length),
      i
    )
  );
  return buffer;
}

/**
 * Desktop trim engine — this IS mobile's `useAudioTrimmer` (the same hook
 * ExportState/TrimPanel drive), wired the same way: commit splices audio +
 * re-times the transcript, with past/future snapshot undo/redo. TrimPanel
 * (start/end handles + silence chips) mounts against `trimmer` directly, so
 * desktop and mobile share one editing engine, not a reimplementation.
 */
export function useStudioEdits(playback: PlaybackLoader, sessionId: string | null): UseStudioEditsReturn {
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);

  const trimmer = useAudioTrimmer(audioBuffer?.duration ?? 0);
  const [past, setPast] = useState<EditSnapshot[]>([]);
  const [future, setFuture] = useState<EditSnapshot[]>([]);

  // Switching clips must not carry over pending trim state or history —
  // it belongs to the previous clip's audio/transcript.
  const resetTrimmer = trimmer.resetAll;
  useEffect(() => {
    resetTrimmer(0);
    setPast([]);
    setFuture([]);
  }, [sessionId, resetTrimmer]);

  const markFillerWords = useCallback(() => {
    const words = transcript ?? [];
    const fillers = words
      .map((word, index) => ({ word, index }))
      .filter(({ word }) => FILLER_PATTERN.test(word.text.trim()))
      .map(({ index }) => index);

    if (fillers.length === 0) {
      toast.info('No filler words found.');
      return;
    }
    for (const index of fillers) {
      if (!trimmer.trimState.deletedWordIndices.has(index)) trimmer.toggleWordDeletion(index);
    }
    toast.success(`Marked ${fillers.length} filler word${fillers.length === 1 ? '' : 's'}`);
  }, [transcript, trimmer]);

  const restoreSnapshot = useCallback(
    (snapshot: EditSnapshot) => {
      useCaptureStore.getState().setAudioBuffer(snapshot.audioBuffer);
      useCaptureStore.getState().setAudioDuration(snapshot.audioBuffer.duration);
      useProcessingStore.getState().setTranscript(snapshot.transcript);
      playback.load(snapshot.audioBuffer);
      trimmer.resetAll(snapshot.audioBuffer.duration);
    },
    [playback, trimmer]
  );

  const commit = useCallback(() => {
    if (!audioBuffer || !trimmer.hasChanges) return;

    const words = transcript ?? [];
    const channels = trimmer.getTrimmedAudio(audioBuffer, words);
    if ((channels[0]?.length ?? 0) === 0) {
      toast.error('These cuts would remove the entire clip.');
      return;
    }
    const nextBuffer = buildAudioBuffer(channels, audioBuffer.sampleRate);
    const nextTranscript = trimmer.getTrimmedTranscript(words);

    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: words }]);
    setFuture([]);

    useCaptureStore.getState().setAudioBuffer(nextBuffer);
    useCaptureStore.getState().setAudioDuration(nextBuffer.duration);
    useProcessingStore.getState().setTranscript(nextTranscript);
    playback.load(nextBuffer);
    trimmer.resetAll(nextBuffer.duration);
  }, [audioBuffer, transcript, trimmer, playback]);

  const undo = useCallback(() => {
    const snapshot = past[past.length - 1];
    if (!snapshot || !audioBuffer) return;
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [{ audioBuffer, transcript: transcript ?? [] }, ...prev.slice(0, MAX_HISTORY - 1)]);
    restoreSnapshot(snapshot);
  }, [past, audioBuffer, transcript, restoreSnapshot]);

  const redo = useCallback(() => {
    const snapshot = future[0];
    if (!snapshot || !audioBuffer) return;
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: transcript ?? [] }]);
    restoreSnapshot(snapshot);
  }, [future, audioBuffer, transcript, restoreSnapshot]);

  const cutRanges = useMemo<CutRange[]>(() => {
    const words = transcript ?? [];
    const duration = audioBuffer?.duration ?? 0;
    const { startTime, endTime, deletedWordIndices } = trimmer.trimState;

    const ranges: CutRange[] = [];
    if (startTime > 0) ranges.push({ start: 0, end: startTime });
    if (duration > 0 && endTime < duration) ranges.push({ start: endTime, end: duration });
    for (const index of deletedWordIndices) {
      const word = words[index];
      if (word) ranges.push({ start: word.start, end: word.end });
    }
    for (const range of trimmer.deletedSilenceRanges.values()) ranges.push(range);

    ranges.sort((a, b) => a.start - b.start);
    const merged: CutRange[] = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end + 0.02) {
        last.end = Math.max(last.end, range.end);
      } else {
        merged.push({ ...range });
      }
    }
    return merged;
  }, [transcript, audioBuffer, trimmer.trimState, trimmer.deletedSilenceRanges]);

  return {
    trimmer,
    cutRanges,
    markFillerWords,
    commit,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
