'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useAnimationTick } from '@/hooks/useAnimationTick';

interface BarsWaveformProps {
  level: number;
  isRecording: boolean;
  compact?: boolean;
}

const waveformWrapper = cva('flex items-center justify-center', {
  variants: { compact: { true: 'h-16', false: 'h-24' } },
  defaultVariants: { compact: false },
});

const barStyle = cva('w-[5px] rounded-full transition-all duration-75', {
  variants: {
    active: {
      true: 'opacity-100',
      false: 'opacity-60',
    },
  },
  defaultVariants: { active: false },
});

export default function BarsWaveform({ level, isRecording, compact = false }: BarsWaveformProps) {
  const bars = compact ? 16 : 24;
  const maxHeight = compact ? 60 : 100;
  const tick = useAnimationTick(true);
  const t = tick * 0.08;

  return (
    <div className={cn(waveformWrapper({ compact }), 'gap-[3px]')} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const distance = Math.abs(i - bars / 2) / (bars / 2);
        const height = isRecording
          ? Math.max(6, (1 - distance * 0.5) * level * maxHeight + Math.sin(t + i * 0.4) * 8)
          : 6 + Math.sin(t * 0.15 + i * 0.3) * 3;

        return (
          <div
            key={i}
            className={barStyle({ active: isRecording })}
            style={{
              // height is a computed float per-bar — must stay as style
              height: `${height}px`,
              // gradient cannot be expressed as a Tailwind class (arbitrary values don't support multi-stop gradients cleanly)
              background: isRecording
                ? 'linear-gradient(to top, #3B82F6, #8B5CF6)'
                : '#2a2a2a',
            }}
          />
        );
      })}
    </div>
  );
}
