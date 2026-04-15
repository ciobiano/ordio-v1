import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { FeatureKey } from '@/lib/featureGates';

export type AppPhase = 'idle' | 'recording' | 'processing';
export type WaveformVariant = 'bars' | 'circle' | 'spectrogram' | 'none';
export type GraphicStyleId = 'graphic-frame1' | 'graphic-frame2' | null;

/** How the canvas is composed: where the visual sits and where captions sit */
export type CanvasLayout = 'top' | 'compact' | 'flipped';

/** How captions are revealed frame-by-frame */
export type CaptionMode = 'phrase' | 'karaoke';
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
