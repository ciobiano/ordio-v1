'use client';

import { ordFieldLabel, ordFieldHint } from '@/lib/ordioVariants';
import { ColorSwatch } from './ColorSwatch';

interface ColorRowProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}

/** Label, optional hint, and a colour well. */
export function ColorRow({ label, hint, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={ordFieldLabel}>{label}</span>
        {hint && <span className={ordFieldHint}>{hint}</span>}
      </span>
      <ColorSwatch value={value} onChange={onChange} label={label} />
    </div>
  );
}
