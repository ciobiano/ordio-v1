'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { WaveformVariant } from '@/lib/store';

// ── Icons ───────────────────────────────────────────────────────────

function BarsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <rect x="1" y="6" width="2" height="4" fill="currentColor" rx="0.5" />
      <rect x="5" y="3" width="2" height="10" fill="currentColor" rx="0.5" />
      <rect x="9" y="5" width="2" height="6" fill="currentColor" rx="0.5" />
      <rect x="13" y="4" width="2" height="8" fill="currentColor" rx="0.5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SpectrogramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <rect x="1" y="2" width="2" height="12" fill="currentColor" rx="1" opacity="0.4" />
      <rect x="4.5" y="4" width="2" height="8" fill="currentColor" rx="1" opacity="0.6" />
      <rect x="8" y="1" width="2" height="14" fill="currentColor" rx="1" opacity="0.8" />
      <rect x="11.5" y="3" width="2" height="10" fill="currentColor" rx="1" opacity="0.5" />
    </svg>
  );
}

function NoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="12" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn('text-white/60 transition-transform duration-200', open && 'rotate-180')}
      aria-hidden="true"
    >
      <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Data ─────────────────────────────────────────────────────────────

const variants: WaveformVariant[] = ['bars', 'circle', 'spectrogram', 'none'];

const icons: Record<WaveformVariant, () => React.ReactElement> = {
  bars: BarsIcon,
  circle: CircleIcon,
  spectrogram: SpectrogramIcon,
  none: NoneIcon,
};

const labels: Record<WaveformVariant, string> = {
  bars: 'Bars',
  circle: 'Circle',
  spectrogram: 'Spectrum',
  none: 'None',
};

// ── Component ────────────────────────────────────────────────────────

export default function WaveformStyleSelector() {
  const waveformStyle = useStore((s) => s.waveformStyle);
  const setWaveformStyle = useStore((s) => s.setWaveformStyle);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  const ActiveIcon = icons[waveformStyle];

  return (
    <div ref={containerRef} className="relative" role="group" aria-label="Waveform style">
      {/* Collapsed pill trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-2',
          'bg-white/5 border border-white/10 backdrop-blur-md',
          'hover:bg-white/10 hover:border-white/20 transition-all duration-150',
          'cursor-pointer select-none'
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Waveform: ${labels[waveformStyle]}. Tap to change.`}
      >
        <span className="text-white/60">
          <ActiveIcon />
        </span>
        <span className="text-white/60 text-xs font-medium tracking-wide">
          {labels[waveformStyle]}
        </span>
        <ChevronIcon open={open} />
      </button>

      {/* Expanded options */}
      <div
        className={cn(
          'absolute bottom-full right-0 mb-2',
          'grid transition-all duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        )}
        inert={!open || undefined}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'flex items-center gap-1.5 p-1.5',
              'bg-white/5 border border-white/10 backdrop-blur-md rounded-xl'
            )}
          >
            {variants.map((variant) => {
              const Icon = icons[variant];
              const isActive = waveformStyle === variant;
              return (
                <button
                  key={variant}
                  onClick={() => {
                    setWaveformStyle(variant);
                    setOpen(false);
                    // Return focus to trigger after selection
                    setTimeout(() => triggerRef.current?.focus(), 0);
                  }}
                  aria-label={`${labels[variant]} waveform`}
                  aria-pressed={isActive}
                  className={cn(
                    'min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center',
                    'transition-all duration-150 cursor-pointer border',
                    isActive
                      ? 'bg-white/20 border-white/40 text-white/90'
                      : 'bg-transparent border-transparent text-white/60 hover:bg-white/10 hover:text-white/80'
                  )}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
