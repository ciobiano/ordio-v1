'use client';

import { cva } from 'class-variance-authority';
import { useAnimationTick } from '@/hooks/useAnimationTick';

interface LineWaveformProps {
  level: number;
  isRecording: boolean;
  compact?: boolean;
}

const lineWrapper = cva('flex items-center justify-center', {
  variants: { compact: { true: 'h-16', false: 'h-24' } },
  defaultVariants: { compact: false },
});

export default function LineWaveform({ level, isRecording, compact = false }: LineWaveformProps) {
  const width = compact ? 120 : 200;
  const height = compact ? 40 : 60;
  const points = 40;
  const tick = useAnimationTick(true);
  const t = tick * 0.06;

  const pathData = Array.from({ length: points })
    .map((_, i) => {
      const x = (i / (points - 1)) * width;
      const amplitude = isRecording ? level * (compact ? 15 : 25) : 3;
      const y = height / 2 + Math.sin(t * 1.2 + i * 0.3) * amplitude;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className={lineWrapper({ compact })}>
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <path
          d={pathData}
          fill="none"
          stroke={isRecording ? 'url(#gradLine)' : '#2a2a2a'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
