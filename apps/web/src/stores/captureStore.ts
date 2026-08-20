'use client';

import { create } from 'zustand';

interface CaptureState {
  // Media source data
  audioBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  /**
   * The voice with a music bed mixed under it, when one has been placed.
   *
   * Kept beside the voice rather than replacing it: `audioBuffer` is the
   * source of truth every re-mix starts from, so overwriting it would make
   * the bed impossible to change or remove afterwards.
   *
   * It lives in the store because the editor and the export screen are
   * different routes. Export reads whichever of the two is present, so a bed
   * placed on the desk reaches the encoder without the exporter needing to
   * know a bed exists.
   */
  mixedBuffer: AudioBuffer | null;
  audioDuration: number;

  // High-level modes
  isRecording: boolean;
  isPlaying: boolean;

  // Actions
  setAudioBlob: (blob: Blob | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setMixedBuffer: (buffer: AudioBuffer | null) => void;
  setAudioDuration: (duration: number) => void;
  setIsRecording: (isRecording: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  resetCapture: () => void;
}

// recordingTime and currentTime are intentionally excluded from this reactive store
// to prevent 60fps global re-renders. They should be managed via local component refs
// or specialized non-reactive subscription channels hook.

const initialState = {
  audioBlob: null as Blob | null,
  audioBuffer: null as AudioBuffer | null,
  mixedBuffer: null as AudioBuffer | null,
  audioDuration: 0,
  isRecording: false,
  isPlaying: false,
};

export const useCaptureStore = create<CaptureState>((set) => ({
  ...initialState,
  
  setAudioBlob: (audioBlob) => set({ audioBlob }),
  setAudioBuffer: (audioBuffer) =>
    /* A new take invalidates any mix built on the previous one. Leaving a
       stale mix here would export the wrong audio entirely. */
    set({ audioBuffer, mixedBuffer: null }),
  setMixedBuffer: (mixedBuffer) => set({ mixedBuffer }),
  setAudioDuration: (audioDuration) => set({ audioDuration }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  resetCapture: () => set(initialState),
}));
