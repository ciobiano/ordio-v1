'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { FeatureKey } from '@/lib/featureGates';
import type {
  AppPhase,
  Theme,
  WaveformVariant,
  GraphicStyleId,
  CanvasLayout,
  CaptionMode,
  FormatVariant,
} from './types';

interface UIState {
  // Configurable / Persisted Settings
  theme: Theme;
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  graphicStyle: GraphicStyleId;
  canvasLayout: CanvasLayout;
  captionMode: CaptionMode;
  format: FormatVariant;

  // Transient Session GUI states
  currentState: AppPhase;
  upgradeTarget: FeatureKey | 'export_limit' | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setStyle: (style: Partial<StyleConfig>) => void;
  setWaveformStyle: (style: WaveformVariant) => void;
  setGraphicStyle: (id: GraphicStyleId) => void;
  setCanvasLayout: (layout: CanvasLayout) => void;
  setCaptionMode: (mode: CaptionMode) => void;
  setFormat: (format: FormatVariant) => void;
  setCurrentState: (state: AppPhase) => void;
  setUpgradeTarget: (target: FeatureKey | 'export_limit' | null) => void;
  resetUI: () => void;
}

const initialPersisted = {
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
  graphicStyle: null as GraphicStyleId,
  canvasLayout: 'standard' as CanvasLayout,
  captionMode: 'phrase' as CaptionMode,
  format: 'square' as FormatVariant,
};

const initialSession = {
  currentState: 'idle' as AppPhase,
  upgradeTarget: null as FeatureKey | 'export_limit' | null,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      ...initialPersisted,
      ...initialSession,

      setTheme: (theme) => set({ theme }),
      setStyle: (newStyle) =>
        set((state) => ({ style: { ...state.style, ...newStyle } })),
      setWaveformStyle: (waveformStyle) => set({ waveformStyle }),
      setGraphicStyle: (graphicStyle) => set({ graphicStyle }),
      setCanvasLayout: (canvasLayout) => set({ canvasLayout }),
      setCaptionMode: (captionMode) => set({ captionMode }),
      setFormat: (format) =>
        set((state) => {
          const dims =
            format === 'square'
              ? { width: 1080, height: 1080 }
              : format === 'vertical'
                ? { width: 1080, height: 1920 }
                : format === 'instagram'
                  ? { width: 1080, height: 1350 }
                  : { width: 1920, height: 1080 };
          return { format, style: { ...state.style, ...dims } };
        }),
      setCurrentState: (currentState) => set({ currentState }),
      setUpgradeTarget: (upgradeTarget) => set({ upgradeTarget }),
      resetUI: () => set(initialSession),
    }),
    {
      name: 'ordio-ui-preferences',
      partialize: (state) => ({
        theme: state.theme,
        style: state.style,
        waveformStyle: state.waveformStyle,
        graphicStyle: state.graphicStyle,
        canvasLayout: state.canvasLayout,
        captionMode: state.captionMode,
        format: state.format,
      }),
    }
  )
);
