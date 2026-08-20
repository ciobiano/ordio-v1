'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores';
import { getCaptionStylePreset, type CaptionStylePreset } from '@Ordio/engine';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import { cn } from '@/lib/utils';
import { ordOptionCard } from '@/lib/variants';
import type { GraphicStyleId, WaveformVariant } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import { OptionCard } from '../controls/OptionCard';

interface VisualEntry {
  value: WaveformVariant;
  label: string;
  gate?: FeatureKey;
}

const VISUALS: VisualEntry[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'orb', label: 'Orb' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'none', label: 'Clean' },
];

const FRAMES: { value: Exclude<GraphicStyleId, null>; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
];

/**
 * Whether the active caption style claims the whole canvas, which suppresses
 * the visual picker entirely.
 *
 * Driven by the engine's per-style flag rather than by the mechanic. The
 * redesign keys this off `anim === 'karaoke'`, which would also strip the
 * waveform out of `cream-block` — the other `static-highlight` style, which
 * pairs its chip with a visual on purpose.
 *
 * That difference is temporary: once active-word colour and active-word
 * background become user controls, `cream-block` is just `karaoke-chip` with a
 * different chip colour and stops earning its place as a separate preset. When
 * it is retired this predicate collapses to a mechanic check, and the two
 * sources agree again.
 */
function captionOwnsStage(preset: CaptionStylePreset): boolean {
  return preset.ownsStage;
}

interface VisualTabProps {
  onLocked?: (feature: FeatureKey) => void;
}

/** Waveform treatment, or one of the two static frames. */
export function VisualTab({ onLocked }: VisualTabProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle);
  const captionStyleId = useUIStore((s) => s.style.captionStyleId);
  const { isLocked } = useFeatureGates();

  const [framesOpen, setFramesOpen] = useState(false);

  if (captionOwnsStage(getCaptionStylePreset(captionStyleId))) {
    return (
      <p className="rounded-2xl bg-white/[0.05] p-4 text-[13px] leading-relaxed text-[color:var(--acid-text-3)]">
        Full-stage caption styles use the whole canvas — visual style doesn&apos;t apply.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {VISUALS.map((visual) => {
        const locked = visual.gate ? isLocked(visual.gate) : false;
        return (
          <OptionCard
            key={visual.value}
            label={visual.label}
            active={graphicStyle === null && waveformStyle === visual.value}
            locked={locked}
            onSelect={() => {
              if (locked && visual.gate) {
                onLocked?.(visual.gate);
                return;
              }
              setGraphicStyle(null);
              setWaveformStyle(visual.value);
              setFramesOpen(false);
            }}
          />
        );
      })}

      <button
        type="button"
        aria-expanded={framesOpen}
        onClick={() => setFramesOpen((open) => !open)}
        className={cn(ordOptionCard({ active: graphicStyle !== null }))}
      >
        <span className="flex-1 text-left text-[15px] font-semibold text-[color:var(--acid-text-1)]">
          Frames
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center text-[color:var(--acid-text-3)]',
            'transition-transform duration-[var(--acid-dur-snap)]',
            framesOpen && 'rotate-90'
          )}
        >
          ›
        </span>
      </button>

      <div
        className={cn(
          'grid overflow-hidden pl-3 transition-[grid-template-rows,opacity]',
          'duration-[var(--acid-dur-snap)] ease-[var(--acid-ease-snap)]',
          framesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="min-h-0">
          <div className="flex gap-2 pt-2">
            {FRAMES.map((frame) => (
              <button
                key={frame.value}
                type="button"
                aria-pressed={graphicStyle === frame.value}
                onClick={() => setGraphicStyle(frame.value)}
                className={cn(
                  ordOptionCard({ active: graphicStyle === frame.value }),
                  'h-10 flex-1 justify-center py-0 text-[13px] font-semibold text-[color:var(--acid-text-1)]'
                )}
              >
                {frame.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
