'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import { useCaptureStore, useProcessingStore } from '@/stores';
import {
  cutRangesFromIndices,
  findFillerWordIndices,
  type CutRange,
} from '@/lib/studio/transcriptCuts';
import type { Word } from '@Ordio/shared/schemas';

interface PlaybackLoader {
  load: (buffer: AudioBuffer) => void;
}

interface EditSnapshot {
  audioBuffer: AudioBuffer;
  transcript: Word[];
}

export interface UseStudioEditsReturn {
  /** Word indices currently marked for cutting (pending, not yet applied). */
  cutIndices: Set<number>;
  /** Pending cuts as merged time ranges — timeline colors these red. */
  cutRanges: CutRange[];
  pendingCount: number;
  canApply: boolean;
  canUndo: boolean;
  toggleWordCut: (index: number) => void;
  markFillerWords: () => void;
  clearCuts: () => void;
  applyCuts: () => void;
  undo: () => void;
}

const MAX_HISTORY = 5;

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
 * Desktop transcript editing (EDL v1): mark words to cut in the transcript,
 * then splice them out of the audio and re-time the transcript in one apply.
 * Reuses mobile's proven cut engine (useAudioTrimmer) — same splice, same
 * retiming — with snapshot-based undo, mirroring ExportState's history.
 */
export function useStudioEdits(playback: PlaybackLoader, sessionId: string | null): UseStudioEditsReturn {
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);

  const trimmer = useAudioTrimmer(audioBuffer?.duration ?? 0);
  const [history, setHistory] = useState<EditSnapshot[]>([]);

  // Switching clips must not carry over pending cuts or undo history —
  // those word indices belong to the previous clip's transcript.
  const resetTrimmer = trimmer.resetAll;
  useEffect(() => {
    resetTrimmer(0);
    setHistory([]);
  }, [sessionId, resetTrimmer]);

  const words = useMemo(() => transcript ?? [], [transcript]);
  const cutIndices = trimmer.trimState.deletedWordIndices;
  const cutRanges = useMemo(
    () => cutRangesFromIndices(words, cutIndices),
    [words, cutIndices]
  );

  const markFillerWords = useCallback(() => {
    const fillers = findFillerWordIndices(words);
    if (fillers.length === 0) {
      toast.info('No filler words found.');
      return;
    }
    for (const index of fillers) {
      if (!cutIndices.has(index)) trimmer.toggleWordDeletion(index);
    }
    toast.success(`Marked ${fillers.length} filler word${fillers.length === 1 ? '' : 's'}`);
  }, [words, cutIndices, trimmer]);

  const applyCuts = useCallback(() => {
    if (!audioBuffer || cutIndices.size === 0) return;

    const channels = trimmer.getTrimmedAudio(audioBuffer, words);
    if ((channels[0]?.length ?? 0) === 0) {
      toast.error('These cuts would remove the entire clip.');
      return;
    }
    const nextBuffer = buildAudioBuffer(channels, audioBuffer.sampleRate);
    const nextTranscript = trimmer.getTrimmedTranscript(words);

    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: words }]);

    useCaptureStore.getState().setAudioBuffer(nextBuffer);
    useCaptureStore.getState().setAudioDuration(nextBuffer.duration);
    useProcessingStore.getState().setTranscript(nextTranscript);
    playback.load(nextBuffer);
    trimmer.resetAll(nextBuffer.duration);
  }, [audioBuffer, words, cutIndices, trimmer, playback]);

  const undo = useCallback(() => {
    const snapshot = history[history.length - 1];
    if (!snapshot) return;
    setHistory((prev) => prev.slice(0, -1));
    useCaptureStore.getState().setAudioBuffer(snapshot.audioBuffer);
    useCaptureStore.getState().setAudioDuration(snapshot.audioBuffer.duration);
    useProcessingStore.getState().setTranscript(snapshot.transcript);
    playback.load(snapshot.audioBuffer);
    trimmer.resetAll(snapshot.audioBuffer.duration);
  }, [history, playback, trimmer]);

  return {
    cutIndices,
    cutRanges,
    pendingCount: cutIndices.size,
    canApply: cutIndices.size > 0 && !!audioBuffer,
    canUndo: history.length > 0,
    toggleWordCut: trimmer.toggleWordDeletion,
    markFillerWords,
    clearCuts: trimmer.clearDeletions,
    applyCuts,
    undo,
  };
}
