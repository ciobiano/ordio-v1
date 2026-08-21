'use client';

/**
 * Making the desk's trim actually cut.
 *
 * The handles wrote `trimIn` and `trimOut` into desk state, the timeline drew
 * a shaded band at each end, and nothing else read either number. Export took
 * the whole buffer. So you could trim thirty seconds off a clip, watch the
 * timeline agree with you, and get the untrimmed clip out — and the panel's
 * own hint said "cuts commit with Apply" while offering no Apply to press.
 *
 * Committing is destructive by design, which is why it is a button and not a
 * side effect of dragging a handle. It rewrites the buffer and the transcript
 * together: they have to move as one, or the captions keep the timings of
 * audio that is no longer there.
 *
 * The arithmetic is `lib/audio/trimGeometry`, the same module the phone's
 * trimmer uses. A second implementation is how the two would come to disagree
 * about where a word lands after the silence in front of it is removed.
 */

import { useCallback } from 'react';
import type { Word } from '@Ordio/shared/schemas';
import { useCaptureStore, useProcessingStore } from '@/stores';
import {
  buildAudioBuffer,
  keptSampleRanges,
  shiftTranscript,
  sliceChannels,
  trimChangesAnything,
  type TrimPlan,
} from '@/lib/audio/trimGeometry';
import type { DeskState } from './deskState';

export interface DeskPause {
  at: number;
  len: number;
}

/**
 * The desk's trim controls, as a plan the shared geometry understands.
 *
 * The desk counts the tail trim inwards from the end while the geometry works
 * in absolute time, so `trimOut` is resolved against the duration here rather
 * than in three call sites. A cut pause is stored by its start time alone; its
 * length comes back from the detected list.
 */
export function deskTrimPlan(
  state: Pick<DeskState, 'trimIn' | 'trimOut' | 'cutPauses'>,
  duration: number,
  pauses: DeskPause[]
): TrimPlan {
  const startTime = Math.max(0, Math.min(state.trimIn, duration));
  const endTime = Math.max(startTime, duration - Math.max(0, state.trimOut));

  const deletedRanges = state.cutPauses
    .map((at) => pauses.find((pause) => pause.at === at))
    .filter((pause): pause is DeskPause => pause !== undefined)
    .map((pause) => ({ start: pause.at, end: pause.at + pause.len }));

  return { startTime, endTime, deletedRanges };
}

interface UseDeskTrimCommitArgs {
  state: DeskState;
  words: Word[];
  duration: number;
  pauses: DeskPause[];
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onCommitted: (buffer: AudioBuffer) => void;
}

export function useDeskTrimCommit({
  state,
  words,
  duration,
  pauses,
  patch,
  onCommitted,
}: UseDeskTrimCommitArgs): { commit: () => void; hasPendingCuts: boolean } {
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);

  const plan = deskTrimPlan(state, duration, pauses);
  const hasPendingCuts = Boolean(audioBuffer) && trimChangesAnything(plan, duration);

  const commit = useCallback(() => {
    if (!audioBuffer) return;

    const current = deskTrimPlan(state, duration, pauses);
    if (!trimChangesAnything(current, duration)) return;

    const kept = keptSampleRanges(current, audioBuffer.sampleRate);
    const channels = sliceChannels(audioBuffer, kept);
    /* Cutting everything would leave a player with nothing to load and no way
       back, so a plan that removes the whole clip is refused rather than
       applied. */
    if ((channels[0]?.length ?? 0) === 0) return;

    const trimmed = buildAudioBuffer(channels, audioBuffer.sampleRate);

    /* Order matters: the transcript is shifted against the *old* timings, so
       it has to be computed before the buffer that replaces them is stored. */
    const shifted = shiftTranscript(current, words);

    useCaptureStore.getState().setAudioBuffer(trimmed);
    useProcessingStore.getState().setTranscript(shifted);
    onCommitted(trimmed);

    /* The handles go back to zero because the cut is now in the audio. Leaving
       them where they were would re-apply the same trim on the next Apply. */
    patch({ trimIn: 0, trimOut: 0, cutPauses: [] }, true);
  }, [audioBuffer, state, duration, pauses, words, patch, onCommitted]);

  return { commit, hasPendingCuts };
}
