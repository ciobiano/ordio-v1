'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
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

  // Color gradient: blue → cyan → green → yellow → magenta
  const colors = [
    '#3B82F6', '#2DD4BF', '#22C55E', '#EAB308', '#F59E0B',
    '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6',
  ];

  return (
    <div className={cn(waveformWrapper({ compact }), 'gap-[2px]')}>
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
            className="rounded-full transition-all duration-75"
            style={{
              width: compact ? '3px' : '4px',
              height: `${height}px`,
              background: isRecording
                ? `linear-gradient(to top, ${cLow}, ${cHigh})`
                : '#2a2a2a',
              opacity: isRecording ? 0.85 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
