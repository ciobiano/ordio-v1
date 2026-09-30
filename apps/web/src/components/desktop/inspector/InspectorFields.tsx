'use client';

/**
 * Shared field primitives for the inspector.
 *
 * The design repeats the same four shapes across all six panels — section
 * label, slider with a live mono readout, toggle row, chip row. Extracting
 * them keeps each panel readable and means a spacing change lands once.
 */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/variants';

export function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <span className="ord-eyebrow">{label}</span>
      {hint && (
        <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.35] text-[var(--text-muted)]">
          {hint}
        </span>
      )}
      {children}
    </section>
  );
}

/**
 * A labelled sub-row inside a section: icon, name, then the control beneath.
 *
 * Mobile groups related choices this way rather than stacking bare chip rows,
 * and the reason holds on desktop — two unlabelled rows of chips under one
 * heading give no clue which is which, or that they are two questions at all.
 */
export function FieldRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <span className="flex-none text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1 ord-type-footnote font-semibold text-[var(--text-body)]">
          {label}
        </span>
      </span>
      {children}
    </div>
  );
}

export function SliderField({
  label,
  value,
  readout,
  min,
  max,
  step = 1,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string;
  value: number;
  readout: string;
  min: number;
  max: number;
  step?: number;
  /* The two ends of the range in plain words. Numbers already live in the
     readout, so captions here say what the range means instead. */
  minLabel?: string;
  maxLabel?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between ord-type-footnote font-semibold text-[var(--text-body)]">
        {label}
        {/* A numeric readout reports state, it does not offer a choice —
            so it is paper. Acid here put the accent on every slider in
            every panel at once. */}
        <span className="font-[family-name:var(--font-mono)] text-[var(--ord-paper)]">
          {readout}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {minLabel && maxLabel && (
        <span className="flex justify-between ord-type-micro text-[var(--text-muted)]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </span>
      )}
    </label>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center justify-between gap-3 text-left"
    >
      <span className="flex flex-col gap-1">
        <span className="ord-type-footnote font-semibold text-[var(--text-body)]">{label}</span>
        {hint && (
          <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.3] text-[var(--text-muted)]">
            {hint}
          </span>
        )}
      </span>
      <span
        className={cn(
          'flex h-[23px] w-[42px] flex-none items-center rounded-full border-2 border-[var(--ord-ink)] p-1 transition-colors duration-[var(--dur-tap)]',
          checked
            ? 'justify-end bg-[var(--ord-acid)]'
            : 'justify-start bg-[var(--ord-paper)]/20'
        )}
      >
        <span className="block size-[15px] rounded-full bg-[var(--ord-ink)]" />
      </span>
    </button>
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: readonly ChipOption<T>[];
  /* null selects nothing — a row can be a live control while the setting it
     writes is not the one currently in force. */
  value: T | null;
  onChange: (id: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={cn('flex gap-2', wrap && 'flex-wrap')}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={chip({ selected: value === option.id, size: 'sm' })}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="ord-type-footnote font-semibold text-[var(--text-body)]">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    </label>
  );
}

/** The scroll body every panel shares. */
export function PanelBody({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-scroll
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-2 pb-5"
    >
      {children}
    </div>
  );
}
