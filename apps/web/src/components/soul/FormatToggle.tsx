'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { FormatVariant } from '@/lib/store';

const formatBtn = cva(
  'px-5 py-2 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer',
  {
    variants: {
      active: {
        true: 'bg-white text-black',
        false: 'text-white/50 hover:text-white hover:bg-white/5',
      },
    },
    defaultVariants: { active: false },
  }
);

const formats: { value: FormatVariant; label: string }[] = [
  { value: 'square', label: '1:1' },
  { value: 'vertical', label: '9:16' },
  { value: 'horizontal', label: '16:9' },
];

export default function FormatToggle() {
  const format = useStore((s) => s.format);
  const setFormat = useStore((s) => s.setFormat);

  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10" role="group" aria-label="Video format">
      {formats.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setFormat(value)}
          aria-pressed={format === value}
          className={cn(formatBtn({ active: format === value }))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
