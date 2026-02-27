'use client';

import { create } from 'zustand';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';

export type AppPhase = 'idle' | 'recording' | 'processing' | 'export';
export type WaveformVariant = 'bars' | 'circle' | 'spectrogram';
export type CaptionVariant = 'bottom' | 'center' | 'karaoke';
export type FormatVariant = 'square' | 'vertical' | 'horizontal';
export type Theme = 'dark' | 'light';
export type TranscriptionSource = 'whisper' | 'webspeech' | null;

interface AppState {
  // Phase
  currentState: AppPhase;

  // Theme
  theme: Theme;

  // Audio
  audioBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  audioDuration: number;

  // Recording
  isRecording: boolean;
  recordingTime: number;

  // Playback
  isPlaying: boolean;
  currentTime: number;

  // Transcription
  transcript: Word[];
  isTranscribing: boolean;
  liveWords: string[];
  transcriptionSource: TranscriptionSource;

  // Export
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;

  // Style
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  captionStyle: CaptionVariant;
  format: FormatVariant;

  // UI
  showControls: boolean;

  // Actions
  setCurrentState: (state: AppPhase) => void;
  setTheme: (theme: Theme) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setAudioDuration: (duration: number) => void;
  setIsRecording: (isRecording: boolean) => void;
  setRecordingTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTranscript: (transcript: Word[]) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setLiveWords: (words: string[]) => void;
  setTranscriptionSource: (source: TranscriptionSource) => void;
  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportedUrl: (url: string | null) => void;
  setStyle: (style: Partial<StyleConfig>) => void;
  setWaveformStyle: (style: WaveformVariant) => void;
  setCaptionStyle: (style: CaptionVariant) => void;
  setFormat: (format: FormatVariant) => void;
  setShowControls: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentState: 'idle' as AppPhase,
  theme: 'dark' as Theme,
  audioBlob: null,
  audioBuffer: null,
  audioDuration: 0,
  isRecording: false,
  recordingTime: 0,
  isPlaying: false,
  currentTime: 0,
  transcript: [] as Word[],
  isTranscribing: false,
  liveWords: [] as string[],
  transcriptionSource: null as TranscriptionSource,
  isExporting: false,
  exportProgress: 0,
  exportedUrl: null,
  style: {
    width: 1080,
    height: 1080,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontFamily: 'Inter' as const,
    fontSize: 72,
    waveColor: '#ffffff',
  },
  waveformStyle: 'bars' as WaveformVariant,
  captionStyle: 'center' as CaptionVariant,
  format: 'square' as FormatVariant,
  showControls: false,
};

export const useStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentState: (currentState) => set({ currentState }),
  setTheme: (theme) => set({ theme }),
  setAudioBlob: (audioBlob) => set({ audioBlob }),
  setAudioBuffer: (audioBuffer) => set({ audioBuffer }),
  setAudioDuration: (audioDuration) => set({ audioDuration }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingTime: (recordingTime) => set({ recordingTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setTranscript: (transcript) => set({ transcript }),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setLiveWords: (liveWords) => set({ liveWords }),
  setTranscriptionSource: (transcriptionSource) => set({ transcriptionSource }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setExportedUrl: (exportedUrl) => set({ exportedUrl }),
  setStyle: (newStyle) =>
    set((state) => ({ style: { ...state.style, ...newStyle } })),
  setWaveformStyle: (waveformStyle) => set({ waveformStyle }),
  setCaptionStyle: (captionStyle) => set({ captionStyle }),
  setFormat: (format) =>
    set((state) => {
      const dims =
        format === 'square'
          ? { width: 1080, height: 1080 }
          : format === 'vertical'
            ? { width: 1080, height: 1920 }
            : { width: 1920, height: 1080 };
      return { format, style: { ...state.style, ...dims } };
    }),
  setShowControls: (showControls) => set({ showControls }),
  reset: () => set(initialState),
}));
