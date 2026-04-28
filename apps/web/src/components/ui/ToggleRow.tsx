'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

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
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const { trigger } = useHaptics();

  const handleChange = (newChecked: boolean) => {
    trigger(newChecked ? 'light' : 'light');
    onChange(newChecked);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 min-h-11',
        disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <Label
          htmlFor={id}
          className={cn(
            'text-xs cursor-pointer',
            checked ? 'text-white/70' : 'text-white/60'
          )}
        >
          {label}
        </Label>
        <span className="text-white/50 text-xs leading-tight">
          {description}
        </span>
      </div>

      <Switch
        id={id}
        checked={checked}
        onCheckedChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
