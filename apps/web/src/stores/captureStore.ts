'use client';

import { create } from 'zustand';

interface CaptureState {
  // Media source data
  audioBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  audioDuration: number;

  // High-level modes
  isRecording: boolean;
  isPlaying: boolean;

  // Actions
  setAudioBlob: (blob: Blob | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
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
  audioDuration: 0,
  isRecording: false,
  isPlaying: false,
};

export const useCaptureStore = create<CaptureState>((set) => ({
  ...initialState,
  
  setAudioBlob: (audioBlob) => set({ audioBlob }),
  setAudioBuffer: (audioBuffer) => set({ audioBuffer }),
  setAudioDuration: (audioDuration) => set({ audioDuration }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  resetCapture: () => set(initialState),
}));
