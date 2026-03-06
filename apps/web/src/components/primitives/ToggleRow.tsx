'use client';

import { cn } from '@/lib/cn';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 group min-h-11',
        disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={cn('text-xs', checked ? 'text-white/70' : 'text-white/60')}>{label}</span>
        <span className="text-white/50 text-[0.625rem] leading-tight">{description}</span>
      </div>

      {/* Toggle switch track + thumb */}
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
          aria-label={label}
        />
        <div
          className={cn(
            'w-8 h-4.5  rounded-full transition-colors duration-150',
            checked ? 'bg-blue-500/60' : 'bg-white/10',
            !disabled &&
              'group-hover:bg-white/15 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50'
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-all duration-150',
            checked ? 'translate-x-2.5 bg-blue-400' : 'translate-x-0 bg-white/40'
          )}
          aria-hidden="true"
        />
      </div>
    </label>
  );
}
