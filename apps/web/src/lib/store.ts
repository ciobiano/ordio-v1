'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';

export type AppPhase = 'idle' | 'recording' | 'processing' | 'export';
export type WaveformVariant = 'bars' | 'circle' | 'spectrogram' | 'none';
export type CaptionVariant = 'bottom' | 'center' | 'karaoke';
export type FormatVariant = 'square' | 'vertical' | 'horizontal' | 'instagram';

export function getCanvasDimensions(format: FormatVariant): { width: number; height: number } {
  switch (format) {
    case 'square':
      return { width: 1080, height: 1080 };
    case 'vertical':
      return { width: 1080, height: 1920 };
    case 'horizontal':
      return { width: 1920, height: 1080 };
    case 'instagram':
      return { width: 1080, height: 1350 };
  }
}
export type Theme = 'dark' | 'light';
export type TranscriptionSource = 'whisper' | null;
export type EnhanceTier = 'none' | 'clean' | 'hd';

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

  // Audio enhancement (server-side, post-recording)
  enhanceTier: EnhanceTier;
  isEnhancing: boolean;
  enhanceProgress: number;


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
  setTranscriptionSource: (source: TranscriptionSource) => void;
  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportedUrl: (url: string | null) => void;
  setStyle: (style: Partial<StyleConfig>) => void;
  setWaveformStyle: (style: WaveformVariant) => void;
  setCaptionStyle: (style: CaptionVariant) => void;
  setFormat: (format: FormatVariant) => void;
  setEnhanceTier: (tier: EnhanceTier) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setEnhanceProgress: (progress: number) => void;
  reset: () => void;
}

/** Preferences persisted to localStorage — survive page reloads and resets */
const initialPreferences = {
  theme: 'dark' as Theme,
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
  enhanceTier: 'none' as EnhanceTier,
};

/** Session state — cleared on page reload and reset */
const initialSession = {
  currentState: 'idle' as AppPhase,
  audioBlob: null as Blob | null,
  audioBuffer: null as AudioBuffer | null,
  audioDuration: 0,
  isRecording: false,
  recordingTime: 0,
  isPlaying: false,
  currentTime: 0,
  transcript: [] as Word[],
  isTranscribing: false,
  transcriptionSource: null as TranscriptionSource,
  isExporting: false,
  exportProgress: 0,
  exportedUrl: null as string | null,
  isEnhancing: false,
  enhanceProgress: 0,
};

const initialState = { ...initialPreferences, ...initialSession };

export const useStore = create<AppState>()(
  persist(
    (set) => ({
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
      setEnhanceTier: (enhanceTier) => set({ enhanceTier }),
      setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
      setEnhanceProgress: (enhanceProgress) => set({ enhanceProgress }),
      reset: () => set(initialSession),
    }),
    {
      name: 'ordio-preferences',
      partialize: (state) => ({
        theme: state.theme,
        style: state.style,
        waveformStyle: state.waveformStyle,
        captionStyle: state.captionStyle,
        format: state.format,
        enhanceTier: state.enhanceTier,
      }),
    }
  )
);
