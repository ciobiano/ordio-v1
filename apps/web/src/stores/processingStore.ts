'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word } from '@Ordio/shared/schemas';
import type { TranscriptionSource, EnhanceTier } from './types';

interface ProcessingState {
  // Transcribing
  transcript: Word[];
  isTranscribing: boolean;
  transcriptionSource: TranscriptionSource;

  // Enhancing (Audio)
  enhanceTier: EnhanceTier; // Persisted preference
  isEnhancing: boolean;
  enhanceProgress: number;

  // Exporting (Video)
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;

  // Actions
  setTranscript: (transcript: Word[]) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscriptionSource: (source: TranscriptionSource) => void;
  
  setEnhanceTier: (tier: EnhanceTier) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setEnhanceProgress: (progress: number) => void;

  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportedUrl: (url: string | null) => void;

  resetProcessing: () => void;
}

const initialPersisted = {
  enhanceTier: 'none' as EnhanceTier,
};

const initialSession = {
  transcript: [] as Word[],
  isTranscribing: false,
  transcriptionSource: null as TranscriptionSource,
  isEnhancing: false,
  enhanceProgress: 0,
  isExporting: false,
  exportProgress: 0,
  exportedUrl: null as string | null,
};

export const useProcessingStore = create<ProcessingState>()(
  persist(
    (set) => ({
      ...initialPersisted,
      ...initialSession,

      setTranscript: (transcript) => set({ transcript }),
      setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
      setTranscriptionSource: (transcriptionSource) => set({ transcriptionSource }),
      setEnhanceTier: (enhanceTier) => set({ enhanceTier }),
      setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
      setEnhanceProgress: (enhanceProgress) => set({ enhanceProgress }),
      setIsExporting: (isExporting) => set({ isExporting }),
      setExportProgress: (exportProgress) => set({ exportProgress }),
      setExportedUrl: (exportedUrl) => set({ exportedUrl }),

      resetProcessing: () => set(initialSession),
    }),
    {
      name: 'ordio-processing-preferences',
      partialize: (state) => ({
        enhanceTier: state.enhanceTier,
      }),
    }
  )
);
