'use client';

import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { ordFieldLabel } from '@/lib/variants';

interface SliderRowProps {
  label: string;
  /** Formatted current value, shown in acid beside the label. */
  valueLabel: string;
  /** Captions under the track — the two ends of the range in plain words. */
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
  /** Dimmed but still operable — Auto fit does this to the size slider. */
  muted?: boolean;
  className?: string;
}

/**
 * Label + live value + range + end captions. Six in the redesign: stroke width,
 * shadow intensity, font size, hold-each-caption, line spacing, character
 * spacing.
 *
 * The end captions are words, never numbers ("Tight"/"Loose", not "-0.6"/"1.4")
 * — the numeric reading lives in `valueLabel` so the two never compete.
 */
export function SliderRow({
  label,
  valueLabel,
  minLabel,
  maxLabel,
  min,
  max,
  step,
  value,
  onChange,
  muted = false,
  className,
}: SliderRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 transition-opacity duration-[var(--acid-dur-snap)]',
        muted && 'opacity-40',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={ordFieldLabel}>{label}</span>
        <span className="text-xs font-bold tabular-nums text-[color:var(--acid-accent)]">
          {valueLabel}
        </span>
      </div>

      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        aria-label={label}
      />

      <div className="flex items-center justify-between text-[11px] text-[color:var(--acid-text-3)]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
