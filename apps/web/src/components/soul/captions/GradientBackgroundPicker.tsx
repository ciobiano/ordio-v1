'use client';

import { cn } from '@/lib/utils';
import { gradientSwatch } from '@/lib/variants';
import { useUIStore } from '@/stores';
import { GRADIENT_BACKGROUND_OPTIONS } from '@Ordio/engine';
import type { GradientVariant } from '@Ordio/engine';

const TILE_CLASS =
  'relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border transition-colors duration-150';

/**
 * Thumbnail strip for colorful gradient backgrounds — the "Wrapped for your
 * voice" direction reused from ShareCard. Preview is free for every tier;
 * export gating (background_gradient) is enforced at export time in
 * ExportState/index.tsx, same pattern as video backgrounds.
 */
export function GradientBackgroundPicker() {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);

  const selected = style.background?.type === 'gradient' ? style.background : null;

  const selectGradient = (variant: GradientVariant) => {
    if (selected?.variant === variant) {
      // Tap again to deselect — back to the solid color
      setStyle({ background: { type: 'solid', color: style.backgroundColor } });
      return;
    }
    setStyle({ background: { type: 'gradient', variant, decoration: 'blob' } });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">Gradient background</span>
      <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Gradient backgrounds">
        {GRADIENT_BACKGROUND_OPTIONS.map((option) => {
          const isSelected = selected?.variant === option.variant;
          return (
            <button
              key={option.variant}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectGradient(option.variant)}
              className={cn(TILE_CLASS, isSelected ? 'border-white/80' : 'border-white/15')}
            >
              <div className={cn(gradientSwatch({ variant: option.variant }), 'absolute inset-0')} />
              <span className="absolute inset-x-0 bottom-0 bg-black/40 px-1 py-0.5 text-[9px] text-white/80 truncate">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
