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
  CaptionStyleId,
  FormatVariant,
  CaptionTransform,
} from './types';

/** Old CaptionMode -> new CaptionStyleId, applied once to localStorage state
 * persisted before the caption-style redesign. See
 * docs/superpowers/specs/2026-07-25-caption-style-redesign-design.md. */
export const LEGACY_CAPTION_MODE_MIGRATION: Record<string, CaptionStyleId> = {
  phrase: 'minimal-lower-third',
  karaoke: 'karaoke-chip',
  spotlight: 'big-statement',
  stack: 'word-pop',
};

interface UIState {
  // Configurable / Persisted Settings
  theme: Theme;
  style: StyleConfig;
  waveformStyle: WaveformVariant;
  graphicStyle: GraphicStyleId;
  canvasLayout: CanvasLayout;
  format: FormatVariant;
  captionTransform: CaptionTransform;

  // Transient Session GUI states
  currentState: AppPhase;
  upgradeTarget: FeatureKey | 'export_limit' | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setStyle: (style: Partial<StyleConfig>) => void;
  setWaveformStyle: (style: WaveformVariant) => void;
  setGraphicStyle: (id: GraphicStyleId) => void;
  setCanvasLayout: (layout: CanvasLayout) => void;
  setFormat: (format: FormatVariant) => void;
  setCaptionTransform: (transform: Partial<CaptionTransform>) => void;
  resetCaptionTransform: () => void;
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
    characterSpacing: 0,
    lineHeight: 1.4,
    captionStyleId: 'minimal-lower-third' as CaptionStyleId,
  },
  waveformStyle: 'bars' as WaveformVariant,
  graphicStyle: null as GraphicStyleId,
  canvasLayout: 'compact' as CanvasLayout,
  format: 'square' as FormatVariant,
  captionTransform: {
    offsetXRatio: 0,
    offsetYRatio: 0,
    scale: 1,
    rotationDeg: 0,
    visible: true,
  } as CaptionTransform,
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
      setStyle: (newStyle) => set((state) => ({ style: { ...state.style, ...newStyle } })),
      setWaveformStyle: (waveformStyle) => set({ waveformStyle }),
      setGraphicStyle: (graphicStyle) => set({ graphicStyle }),
      setCanvasLayout: (canvasLayout) => set({ canvasLayout }),
      setCaptionTransform: (transform) =>
        set((state) => ({
          captionTransform: {
            ...state.captionTransform,
            ...transform,
          },
        })),
      resetCaptionTransform: () =>
        set({
          captionTransform: {
            offsetXRatio: 0,
            offsetYRatio: 0,
            scale: 1,
            rotationDeg: 0,
            visible: true,
          },
        }),
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
      version: 1,
      migrate: (persistedState, version) => {
        if (version >= 1) return persistedState as UIState;
        const legacy = persistedState as Record<string, unknown> & {
          style?: StyleConfig;
          captionMode?: string;
        };
        const captionStyleId =
          (legacy.captionMode && LEGACY_CAPTION_MODE_MIGRATION[legacy.captionMode]) ||
          initialPersisted.style.captionStyleId;
        return {
          ...legacy,
          style: { ...(legacy.style ?? initialPersisted.style), captionStyleId },
        } as UIState;
      },
      partialize: (state) => ({
        theme: state.theme,
        style: state.style,
        waveformStyle: state.waveformStyle,
        graphicStyle: state.graphicStyle,
        canvasLayout: state.canvasLayout,
        format: state.format,
        captionTransform: state.captionTransform,
      }),
    }
  )
);
