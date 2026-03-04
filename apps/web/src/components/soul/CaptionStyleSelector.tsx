'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { optionBtn } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { CaptionVariant } from '@/lib/store';

const styles: CaptionVariant[] = ['bottom', 'center', 'karaoke'];

export default function CaptionStyleSelector() {
  const captionStyle = useStore((s) => s.captionStyle);
  const setCaptionStyle = useStore((s) => s.setCaptionStyle);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
        const isSelected = captionStyle === style;
        return (
          <button
            key={style}
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
        );
      })}
    </div>
  );
}
