'use client';

import { cn } from '@/lib/utils';
import {
  ordToggleTrack,
  ordToggleThumb,
  ordFieldCard,
  ordFieldLabel,
  ordFieldHint,
} from '@/lib/variants';

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: 'sm' | 'md';
  /** `card` sits in a recessed field; `bare` sits flush in a list of rows. */
  surface?: 'card' | 'bare';
  /** Trailing element between the label and the switch — e.g. a colour swatch. */
  adornment?: React.ReactNode;
}

/**
 * Labelled switch. Six of these in the redesign: active-word background,
 * caption background, auto fit, hide auto punctuation, apply-to-all, and the
 * Creator preview toggle.
 *
 * The switch is a real `role="switch"` button rather than a styled checkbox so
 * the 44px touch target stays on the control the user actually aims at — the
 * design draws it at 46×26, which is under the minimum on its own, so the
 * padding comes from the row.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  size = 'md',
  surface = 'card',
  adornment,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        surface === 'card' ? cn(ordFieldCard, 'flex-row py-3') : 'min-h-11'
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={ordFieldLabel}>{label}</span>
        {hint && <span className={ordFieldHint}>{hint}</span>}
      </span>

      <span className="flex shrink-0 items-center gap-2.5">
        {adornment}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={cn(ordToggleTrack({ size, on: checked }))}
        >
          <span className={cn(ordToggleThumb({ size }))} />
        </button>
      </span>
    </div>
  );
}
