export type {
  WaveformVariant,
  GraphicStyleId,
  CanvasLayout,
  CaptionMode,
  CaptionAnimation,
  CaptionTransform,
  CaptionGroup,
} from '@Ordio/engine/types';

export type AppPhase = 'idle' | 'recording' | 'processing';
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
