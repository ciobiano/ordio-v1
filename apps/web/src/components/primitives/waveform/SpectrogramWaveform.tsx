'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useAnimationTick } from '@/hooks/useAnimationTick';

interface SpectrogramWaveformProps {
  level: number;
  isRecording: boolean;
  compact?: boolean;
}

const waveformWrapper = cva('flex items-end justify-center', {
  variants: { compact: { true: 'h-16', false: 'h-24' } },
  defaultVariants: { compact: false },
});

/**
 * Spectrogram-style waveform — vertical frequency bands with color gradients.
 * Each band represents a frequency range, colored from cool (low) to warm (high).
 */
export default function SpectrogramWaveform({
  level,
  isRecording,
  compact = false,
}: SpectrogramWaveformProps) {
  const bands = compact ? 20 : 32;
  const maxHeight = compact ? 56 : 88;
  const tick = useAnimationTick(true);
  const t = tick * 0.06;

  // Monochrome gradient: 8 opacity steps of --primary (rgba(250,248,245,...))
  const colors = [
    'rgba(250,248,245,0.3)',
    'rgba(250,248,245,0.4)',
    'rgba(250,248,245,0.5)',
    'rgba(250,248,245,0.6)',
    'rgba(250,248,245,0.7)',
    'rgba(250,248,245,0.8)',
    'rgba(250,248,245,0.9)',
    'rgba(250,248,245,1.0)',
  ];

  return (
    <div className={cn(waveformWrapper({ compact }), 'gap-0.5')} aria-hidden="true">
      {Array.from({ length: bands }).map((_, i) => {
        const norm = i / (bands - 1);

        // Simulate frequency bands — lower bands are steadier, higher bands are more reactive
        const freqReactivity = 0.4 + norm * 0.6;
        const baseWave = Math.sin(t * 2.5 + i * 0.5) * 0.3 + Math.sin(t * 1.3 + i * 0.8) * 0.2;
        const height = isRecording
          ? Math.max(4, (level * freqReactivity + baseWave * level) * maxHeight)
          : 4 + Math.sin(t * 0.2 + i * 0.25) * 2;

        // Pick color from gradient based on band position
        const colorIdx = norm * (colors.length - 1);
        const cLow = colors[Math.floor(colorIdx)];
        const cHigh = colors[Math.min(Math.ceil(colorIdx), colors.length - 1)];

        return (
          <div
            key={i}
            className={`rounded-full transition-all duration-75 ${compact ? 'w-[3px]' : 'w-1'} ${isRecording ? 'opacity-85' : 'opacity-60'}`}
            style={{
              height: `${height}px`,
              background: isRecording
                ? `linear-gradient(to top, ${cLow}, ${cHigh})`
                : 'rgba(255,255,255,0.08)',
            }}
          />
        );
      })}
    </div>
  );
}
