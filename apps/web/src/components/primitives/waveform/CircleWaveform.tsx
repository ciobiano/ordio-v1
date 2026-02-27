'use client';

import { cva } from 'class-variance-authority';
import { useAnimationTick } from '@/hooks/useAnimationTick';

interface CircleWaveformProps {
  level: number;
  isRecording: boolean;
  compact?: boolean;
}

const waveformWrapper = cva('flex items-center justify-center', {
  variants: { compact: { true: 'h-16', false: 'h-24' } },
  defaultVariants: { compact: false },
});

const circleSize = cva('relative rounded-full transition-transform duration-75', {
  variants: { compact: { true: 'w-20 h-20', false: 'w-20 h-20' } },
  defaultVariants: { compact: false },
});

export default function CircleWaveform({ level, isRecording, compact = false }: CircleWaveformProps) {
  const tick = useAnimationTick(!isRecording);
  const t = tick * 0.06;

  // scale and glow are computed floats — must stay as style
  const scale = isRecording ? 1 + level * 0.25 : 1 + Math.sin(t) * 0.03;
  const glowIntensity = isRecording ? level * 30 : 0;

  return (
    <div className={waveformWrapper({ compact })}>
      <div
        className={circleSize({ compact })}
        style={{
          transform: `scale(${scale})`,
          background: isRecording
            ? 'radial-gradient(circle, #3B82F6 0%, #1E3A8A 70%, transparent 100%)'
            : 'radial-gradient(circle, #222 0%, #111 70%, transparent 100%)',
          boxShadow:
            isRecording && glowIntensity > 0
              ? `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(59,130,246,0.4)`
              : 'none',
        }}
      />
    </div>
  );
}
