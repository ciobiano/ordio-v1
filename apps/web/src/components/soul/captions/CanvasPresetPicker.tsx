'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { CANVAS_PRESETS, rgbStringToHex } from '@Ordio/engine';

const TILE_CLASS =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-colors duration-150';

/**
 * Thumbnail strip for Ordio's curated canvas-preset artwork. Selecting a
 * preset sets the background image and the matching caption accent color
 * together — the two ship as a pair per canvasPresets.ts's per-preset
 * accentColor, unlike Gradient/Video/Image backgrounds which only touch
 * `background`.
 */
export function CanvasPresetPicker() {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);

  const selected =
    style.background?.type === 'image' && style.background.source === 'preset'
      ? style.background
      : null;

  const selectPreset = (id: string) => {
    if (selected?.assetId === id) {
      // Tap again to deselect — back to solid color, drop the paired accent
      setStyle({
        background: { type: 'solid', color: style.backgroundColor },
        accentColor: undefined,
      });
      return;
    }
    const preset = CANVAS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setStyle({
      background: { type: 'image', source: 'preset', assetId: preset.id },
      accentColor: rgbStringToHex(preset.accentColor),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">Preset background</span>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Canvas preset backgrounds"
      >
        {CANVAS_PRESETS.map((preset) => {
          const isSelected = selected?.assetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectPreset(preset.id)}
              className={cn(TILE_CLASS, isSelected ? 'border-white/80' : 'border-white/15')}
            >
              <Image
                src={preset.imagePath}
                alt={preset.label}
                fill
                sizes="64px"
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] text-white/80 truncate"
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
