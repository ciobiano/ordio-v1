'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { optionBtn } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { FormatVariant } from '@/lib/store';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import LockBadge from '@/components/primitives/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

const formats: { value: FormatVariant; label: string }[] = [
  { value: 'square',     label: '1:1' },
  { value: 'vertical',   label: '9:16' },
  { value: 'horizontal', label: '16:9' },
  { value: 'instagram',  label: '4:5' },
];

const formatFeatureKey: Partial<Record<FormatVariant, FeatureKey>> = {
  vertical:   'format_vertical',
  horizontal: 'format_horizontal',
  instagram:  'format_instagram',
};

interface FormatToggleProps {
  onLocked?: (feature: FeatureKey) => void;
}

export default function FormatToggle({ onLocked }: FormatToggleProps) {
  const format = useStore((s) => s.format);
  const setFormat = useStore((s) => s.setFormat);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { isLocked } = useFeatureGates();

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % formats.length;
      setFormat(formats[next].value);
      btnRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + formats.length) % formats.length;
      setFormat(formats[prev].value);
      btnRefs.current[prev]?.focus();
    }
  };

  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Video format">
      {formats.map(({ value, label }, i) => {
        const featureKey = formatFeatureKey[value];
        const locked = featureKey ? isLocked(featureKey) : false;
        const isSelected = format === value;
        return (
          <div key={value} className="relative">
            <button
              ref={(el) => { btnRefs.current[i] = el; }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setFormat(value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(optionBtn({ shape: 'rect', active: isSelected, tone: 'white' }))}
            >
              {label}
            </button>
            {locked && featureKey && (
              <LockBadge
                onClick={() => onLocked?.(featureKey)}
                label={`${label} format requires Creator`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
