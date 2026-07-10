// apps/web/src/components/soul/export/useTrimHistory.ts
'use client';

import { useCallback, useState } from 'react';
import { useCaptureStore, useProcessingStore } from '@/stores';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { Word } from '@Ordio/shared/schemas';

type TrimSnapshot = { audioBuffer: AudioBuffer; transcript: Word[] };
const MAX_HISTORY = 5;

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  });
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  );
  return buf;
}

interface UseTrimHistoryParams {
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
}

export interface UseTrimHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  commit: () => void;
  undo: () => void;
  redo: () => void;
}

export function useTrimHistory({ playback, trimmer }: UseTrimHistoryParams): UseTrimHistoryReturn {
  const [past, setPast] = useState<TrimSnapshot[]>([]);
  const [future, setFuture] = useState<TrimSnapshot[]>([]);

  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);

  const restoreSnapshot = useCallback(
    (snap: TrimSnapshot) => {
      useCaptureStore.getState().setAudioBuffer(snap.audioBuffer);
      useProcessingStore.getState().setTranscript(snap.transcript);
      playback.load(snap.audioBuffer);
      trimmer.resetAll(snap.audioBuffer.duration);
    },
    [playback, trimmer]
  );

  const commit = useCallback(() => {
    if (!audioBuffer || !trimmer.hasChanges) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript ?? []);
    if ((trimmedChannels[0]?.length ?? 0) === 0) return;
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript ?? []);

    setPast((prev) => [
      ...prev.slice(-(MAX_HISTORY - 1)),
      { audioBuffer, transcript: transcript ?? [] },
    ]);
    setFuture([]);

    useCaptureStore.getState().setAudioBuffer(trimmedBuffer);
    useProcessingStore.getState().setTranscript(trimmedTranscript);
    playback.load(trimmedBuffer);
    trimmer.resetAll(trimmedBuffer.duration);
  }, [audioBuffer, transcript, trimmer, playback]);

  const undo = useCallback(() => {
    if (past.length === 0 || !audioBuffer) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ audioBuffer, transcript: transcript ?? [] }, ...f.slice(0, MAX_HISTORY - 1)]);
    restoreSnapshot(prev);
  }, [past, audioBuffer, transcript, restoreSnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0 || !audioBuffer) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: transcript ?? [] }]);
    restoreSnapshot(next);
  }, [future, audioBuffer, transcript, restoreSnapshot]);

  return { canUndo: past.length > 0, canRedo: future.length > 0, commit, undo, redo };
}
