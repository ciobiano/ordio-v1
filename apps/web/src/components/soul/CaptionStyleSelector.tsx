'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { optionBtn } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { CaptionVariant } from '@/lib/store';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import LockBadge from '@/components/primitives/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

const styles: CaptionVariant[] = ['bottom', 'center', 'karaoke'];

const captionFeatureKey: Partial<Record<CaptionVariant, FeatureKey>> = {
  center: 'caption_center',
  karaoke: 'caption_karaoke',
};

interface CaptionStyleSelectorProps {
  onLocked?: (feature: FeatureKey) => void;
}

export default function CaptionStyleSelector({ onLocked }: CaptionStyleSelectorProps) {
  const captionStyle = useStore((s) => s.captionStyle);
  const setCaptionStyle = useStore((s) => s.setCaptionStyle);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { isLocked } = useFeatureGates();

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % styles.length;
      setCaptionStyle(styles[next]);
      btnRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + styles.length) % styles.length;
      setCaptionStyle(styles[prev]);
      btnRefs.current[prev]?.focus();
    }
  };

  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Caption style">
      <span className="text-white/50 text-xs mr-1" aria-hidden="true">Caption:</span>
      {styles.map((style, i) => {
        const featureKey = captionFeatureKey[style];
        const locked = featureKey ? isLocked(featureKey) : false;
        const isSelected = captionStyle === style;
        return (
          <div key={style} className="relative">
            <button
              ref={(el) => { btnRefs.current[i] = el; }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setCaptionStyle(style)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(optionBtn({ shape: 'pill', tone: 'blue', active: isSelected }))}
            >
              {style}
            </button>
            {locked && featureKey && (
              <LockBadge onClick={() => onLocked?.(featureKey)} label={`${style} captions require Creator`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
