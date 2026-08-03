'use client';

import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  /** Show the hex reading beside the swatch. Off when space is tight. */
  showHex?: boolean;
  className?: string;
}

/**
 * A colour well. The native `<input type="color">` is kept for the platform
 * picker but visually replaced — the native control can't be given the design's
 * 3px ink border consistently across browsers.
 *
 * Used standalone as a `ToggleRow` adornment and wrapped by `ColorRow`.
 */
export function ColorSwatch({ value, onChange, label, showHex = true, className }: ColorSwatchProps) {
  return (
    <label
      className={cn('flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5', className)}
      aria-label={`${label} colour`}
    >
      {showHex && (
        <span className="font-mono text-[11px] uppercase tabular-nums text-[color:var(--acid-text-3)]">
          {value}
        </span>
      )}
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
  );
}
