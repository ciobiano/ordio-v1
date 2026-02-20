'use client';

import type { WaveformVariant } from '@/lib/store';
import BarsWaveform from './BarsWaveform';
import CircleWaveform from './CircleWaveform';
import LineWaveform from './LineWaveform';

interface WaveformDisplayProps {
  variant: WaveformVariant;
  level: number;
  isRecording: boolean;
  compact?: boolean;
}

export default function WaveformDisplay({
  variant,
  level,
  isRecording,
  compact = false,
}: WaveformDisplayProps) {
  switch (variant) {
    case 'circle':
      return <CircleWaveform level={level} isRecording={isRecording} compact={compact} />;
    case 'line':
      return <LineWaveform level={level} isRecording={isRecording} compact={compact} />;
    default:
      return <BarsWaveform level={level} isRecording={isRecording} compact={compact} />;
  }
}
