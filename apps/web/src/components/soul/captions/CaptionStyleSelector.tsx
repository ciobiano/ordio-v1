'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { optionBtn } from '@/lib/variants';
import { useUIStore } from '@/stores';
import type { CanvasLayout, CaptionMode } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

const LAYOUTS: { value: CanvasLayout; label: string; featureKey?: FeatureKey }[] = [
  { value: 'top', label: 'Top' },
  { value: 'compact', label: 'Compact' },
  { value: 'flipped', label: 'Flipped', featureKey: 'layout_flipped' },
];

const MODES: { value: CaptionMode; label: string; featureKey?: FeatureKey }[] = [
  { value: 'phrase', label: 'Phrase' },
  { value: 'karaoke', label: 'Karaoke', featureKey: 'caption_karaoke' },
];

interface CaptionStyleSelectorProps {
  onLocked?: (feature: FeatureKey) => void;
}

export default function CaptionStyleSelector({ onLocked }: CaptionStyleSelectorProps) {
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout);
  const captionMode = useUIStore((s) => s.captionMode);
  const setCaptionMode = useUIStore((s) => s.setCaptionMode);
  const layoutRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { isLocked } = useFeatureGates();

  const handleLayoutKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % LAYOUTS.length;
      setCanvasLayout(LAYOUTS[next].value);
      layoutRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + LAYOUTS.length) % LAYOUTS.length;
      setCanvasLayout(LAYOUTS[prev].value);
      layoutRefs.current[prev]?.focus();
    }
  };

  const handleModeKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % MODES.length;
      setCaptionMode(MODES[next].value);
      modeRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + MODES.length) % MODES.length;
      setCaptionMode(MODES[prev].value);
      modeRefs.current[prev]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Canvas layout">
        <span className="text-muted-foreground text-xs mr-1 w-12 shrink-0" aria-hidden="true">
          Layout:
        </span>
        {LAYOUTS.map(({ value, label, featureKey }, i) => {
          const locked = featureKey ? isLocked(featureKey) : false;
          const isSelected = canvasLayout === value;
          return (
            <div key={value} className="relative">
              <button
                ref={(el) => {
                  layoutRefs.current[i] = el;
                }}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setCanvasLayout(value)}
                onKeyDown={(e) => handleLayoutKey(e, i)}
                className={cn(optionBtn({ shape: 'pill', tone: 'white', active: isSelected }))}
              >
                {label}
              </button>
              {locked && featureKey && (
                <LockBadge
                  onClick={() => onLocked?.(featureKey)}
                  label={`${label} layout requires Creator`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2" role="radiogroup" aria-label="Caption mode">
        <span className="text-muted-foreground text-xs mr-1 w-12 shrink-0" aria-hidden="true">
          Mode:
        </span>
        {MODES.map(({ value, label, featureKey }, i) => {
          const locked = featureKey ? isLocked(featureKey) : false;
          const isSelected = captionMode === value;
          return (
            <div key={value} className="relative">
              <button
                ref={(el) => {
                  modeRefs.current[i] = el;
                }}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setCaptionMode(value)}
                onKeyDown={(e) => handleModeKey(e, i)}
                className={cn(optionBtn({ shape: 'pill', tone: 'white', active: isSelected }))}
              >
                {label}
              </button>
              {locked && featureKey && (
                <LockBadge
                  onClick={() => onLocked?.(featureKey)}
                  label={`${label} captions require Creator`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
