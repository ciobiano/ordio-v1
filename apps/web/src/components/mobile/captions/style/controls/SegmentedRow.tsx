'use client';

import { cn } from '@/lib/utils';
import { ordSegmentTrack, ordSegmentBtn, ordSectionLabel } from '@/lib/variants';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedRowProps<T extends string> {
  /** Omit to render the track with no heading (Templates backdrop switcher). */
  label?: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Accessible name for the group when `label` is omitted. */
  ariaLabel?: string;
}

/**
 * Pill track of equal-width options. Used by Templates (backdrop source),
 * Font (alignment, capitalization) and Layout (position).
 *
 * `role="radiogroup"` rather than a tablist: these set a value, they don't
 * reveal a panel. The one exception — the Templates backdrop switcher — does
 * swap content, but it also persists a choice, so radio semantics still read
 * correctly to a screen reader.
 */
export function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: SegmentedRowProps<T>) {
  const track = (
    <div className={ordSegmentTrack} role="radiogroup" aria-label={ariaLabel ?? label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(ordSegmentBtn({ size, active }))}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  if (!label) return track;

  return (
    <div className="flex flex-col gap-2">
      <span className={ordSectionLabel}>{label}</span>
      {track}
    </div>
  );
}
