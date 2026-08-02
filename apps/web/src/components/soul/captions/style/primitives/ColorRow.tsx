'use client';

import { ordFieldLabel, ordFieldHint } from '@/lib/ordioVariants';

interface ColorRowProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Label + hex readout + swatch. The native `<input type="color">` is kept (it
 * gets the platform picker for free) but visually replaced: the real input is
 * sr-only and the swatch is a styled span, because the native control can't be
 * given the design's 3px ink border on every browser.
 *
 * The whole thing is one `<label>`, so the hex and the swatch are both hit
 * targets for the picker.
 */
export function ColorRow({ label, hint, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={ordFieldLabel}>{label}</span>
        {hint && <span className={ordFieldHint}>{hint}</span>}
      </span>

      <label
        className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5"
        aria-label={`${label} colour`}
      >
        <span className="font-mono text-[11px] uppercase tabular-nums text-[color:var(--acid-text-3)]">
          {value}
        </span>
        <span
          aria-hidden="true"
          className="block h-[34px] w-[34px] shrink-0 rounded-lg border-[3px] border-[color:var(--acid-bg-base)]"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          aria-label={`Pick ${label} colour`}
        />
      </label>
    </div>
  );
}
