'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useStore, type WaveformVariant, type GraphicStyleId } from '@/lib/store';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import LockBadge from '@/components/primitives/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

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

function GraphicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-current" aria-hidden="true">
      <rect x="1" y="2" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 9l4-3 3 2.5 3-3.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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

type GraphicVariant = NonNullable<GraphicStyleId>;

const graphicVariants: GraphicVariant[] = ['graphic-frame1', 'graphic-frame2'];

const graphicLabels: Record<GraphicVariant, string> = {
  'graphic-frame1': 'Frame 1',
  'graphic-frame2': 'Frame 2',
};

// ── Component ────────────────────────────────────────────────────────

const variantFeatureKey: Partial<Record<WaveformVariant, FeatureKey>> = {
  circle: 'waveform_circle',
  spectrogram: 'waveform_spectrogram',
};

interface StyleModeSelectorProps {
  onLocked?: (feature: FeatureKey) => void;
}

export default function StyleModeSelector({ onLocked }: StyleModeSelectorProps) {
  const waveformStyle = useStore((s) => s.waveformStyle);
  const setWaveformStyle = useStore((s) => s.setWaveformStyle);
  const graphicStyle = useStore((s) => s.graphicStyle);
  const setGraphicStyle = useStore((s) => s.setGraphicStyle);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isLocked } = useFeatureGates();

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

  const activeIsGraphic = graphicStyle !== null;
  const ActiveIcon = activeIsGraphic ? GraphicIcon : icons[waveformStyle];
  const activeLabel = activeIsGraphic ? graphicLabels[graphicStyle!] : labels[waveformStyle];

  return (
    <div ref={containerRef} className="relative" role="group" aria-label="Waveform style">
      {/* Collapsed pill trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'min-h-11 px-3 py-2 rounded-xl flex items-center gap-2',
          'bg-white/5 border border-white/10 backdrop-blur-md',
          'hover:bg-white/10 hover:border-white/20 transition-all duration-150',
          'cursor-pointer select-none'
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Style: ${activeLabel}. Tap to change.`}
      >
        <span className="text-white/60">
          <ActiveIcon />
        </span>
        <span className="text-white/60 text-xs font-medium tracking-wide">
          {activeLabel}
        </span>
        <ChevronIcon open={open} />
      </button>

      {/* Expanded options */}
      <div
        className={cn(
          'absolute bottom-full right-0 mb-2 w-max',
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
              const featureKey = variantFeatureKey[variant];
              const locked = featureKey ? isLocked(featureKey) : false;
              const Icon = icons[variant];
              const isActive = waveformStyle === variant && !activeIsGraphic;
              return (
                <div key={variant} className="relative">
                  <button
                    onClick={() => {
                      setWaveformStyle(variant);
                      setGraphicStyle(null);
                      setOpen(false);
                      // Return focus to trigger after selection
                      setTimeout(() => triggerRef.current?.focus(), 0);
                    }}
                    aria-label={`${labels[variant]} waveform`}
                    aria-pressed={isActive}
                    className={cn(
                      'min-w-11 min-h-11 rounded-lg flex items-center justify-center',
                      'transition-all duration-150 cursor-pointer border',
                      isActive
                        ? 'bg-white/20 border-white/40 text-white/90'
                        : 'bg-transparent border-transparent text-white/60 hover:bg-white/10 hover:text-white/80'
                    )}
                  >
                    <Icon />
                  </button>
                  {locked && featureKey && (
                    <LockBadge onClick={() => onLocked?.(featureKey)} label={`${labels[variant]} requires Creator`} />
                  )}
                </div>
              );
            })}

            {/* Divider */}
            <div className="w-px h-6 bg-white/10 mx-0.5" aria-hidden="true" />

            {/* Graphics section */}
            {graphicVariants.map((variant) => {
              const isActive = graphicStyle === variant;
              return (
                <button
                  key={variant}
                  onClick={() => {
                    setGraphicStyle(variant);
                    setOpen(false);
                    setTimeout(() => triggerRef.current?.focus(), 0);
                  }}
                  aria-label={`${graphicLabels[variant]} graphic style`}
                  aria-pressed={isActive}
                  className={cn(
                    'min-w-11 min-h-11 rounded-lg flex flex-col items-center justify-center gap-0.5',
                    'transition-all duration-150 cursor-pointer border',
                    isActive
                      ? 'bg-white/20 border-white/40 text-white/90'
                      : 'bg-transparent border-transparent text-white/60 hover:bg-white/10 hover:text-white/80'
                  )}
                >
                  <GraphicIcon />
                  <span className="text-[9px] font-medium tracking-wide leading-none">{graphicLabels[variant]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
