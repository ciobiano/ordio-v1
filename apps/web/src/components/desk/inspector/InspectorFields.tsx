'use client';

/**
 * Shared field primitives for the inspector.
 *
 * The design repeats the same four shapes across all six panels — section
 * label, slider with a live mono readout, toggle row, chip row. Extracting
 * them keeps each panel readable and means a spacing change lands once.
 */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/desk/deskVariants';

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

export function SliderField({
  label,
  value,
  readout,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  readout: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between ord-type-footnote font-bold text-[var(--text-body)]">
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
      <span className="flex flex-col gap-0.5">
        <span className="ord-type-footnote font-bold text-[var(--text-body)]">{label}</span>
        {hint && (
          <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.3] text-[var(--text-muted)]">
            {hint}
          </span>
        )}
      </span>
      <span
        className={cn(
          'flex h-[23px] w-[42px] flex-none items-center rounded-full border-2 border-[var(--ord-ink)] p-0.5 transition-colors',
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
  value: T;
  onChange: (id: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={cn('flex gap-1.5', wrap && 'flex-wrap')}>
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
      <span className="ord-type-footnote font-bold text-[var(--text-body)]">{label}</span>
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
      className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-1.5 pb-[18px]"
    >
      {children}
    </div>
  );
}
