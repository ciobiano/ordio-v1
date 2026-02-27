'use client';

import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { WaveformVariant } from '@/lib/store';

const selectorBtn = cva(
  'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer border',
  {
    variants: {
      active: {
        true: 'bg-white/20 border-white/40',
        false: 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
      },
    },
    defaultVariants: { active: false },
  }
);

function BarsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60" aria-hidden="true">
      <rect x="1" y="6" width="2" height="4" fill="currentColor" rx="0.5" />
      <rect x="5" y="3" width="2" height="10" fill="currentColor" rx="0.5" />
      <rect x="9" y="5" width="2" height="6" fill="currentColor" rx="0.5" />
      <rect x="13" y="4" width="2" height="8" fill="currentColor" rx="0.5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SpectrogramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60" aria-hidden="true">
      <rect x="1" y="2" width="2" height="12" fill="currentColor" rx="1" opacity="0.4" />
      <rect x="4.5" y="4" width="2" height="8" fill="currentColor" rx="1" opacity="0.6" />
      <rect x="8" y="1" width="2" height="14" fill="currentColor" rx="1" opacity="0.8" />
      <rect x="11.5" y="3" width="2" height="10" fill="currentColor" rx="1" opacity="0.5" />
    </svg>
  );
}

const icons: Record<WaveformVariant, () => React.ReactElement> = {
  bars: BarsIcon,
  circle: CircleIcon,
  spectrogram: SpectrogramIcon,
};

const labels: Record<WaveformVariant, string> = {
  bars: 'Bar waveform',
  circle: 'Circle waveform',
  spectrogram: 'Spectrogram waveform',
};

export default function WaveformStyleSelector() {
  const waveformStyle = useStore((s) => s.waveformStyle);
  const setWaveformStyle = useStore((s) => s.setWaveformStyle);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Waveform style">
      <span className="text-white/20 text-xs mr-1" aria-hidden="true">Wave:</span>
      {(['bars', 'circle', 'spectrogram'] as WaveformVariant[]).map((style) => {
        const Icon = icons[style];
        return (
          <button
            key={style}
            onClick={() => setWaveformStyle(style)}
            aria-label={labels[style]}
            aria-pressed={waveformStyle === style}
            className={cn(selectorBtn({ active: waveformStyle === style }))}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
