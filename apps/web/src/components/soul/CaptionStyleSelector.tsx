'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { CaptionVariant } from '@/lib/store';

const captionBtn = cva(
  'px-3 py-1.5 rounded-full text-xs capitalize transition-all duration-150 cursor-pointer',
  {
    variants: {
      active: {
        true: 'bg-blue-500 text-white',
        false: 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80',
      },
    },
    defaultVariants: { active: false },
  }
);

const styles: CaptionVariant[] = ['bottom', 'center', 'karaoke'];

export default function CaptionStyleSelector() {
  const captionStyle = useStore((s) => s.captionStyle);
  const setCaptionStyle = useStore((s) => s.setCaptionStyle);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Caption style">
      <span className="text-white/30 text-xs mr-1" aria-hidden="true">Caption:</span>
      {styles.map((style) => (
        <button
          key={style}
          onClick={() => setCaptionStyle(style)}
          aria-pressed={captionStyle === style}
          className={cn(captionBtn({ active: captionStyle === style }))}
        >
          {style}
        </button>
      ))}
    </div>
  );
}
