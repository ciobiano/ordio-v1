'use client';

import { cn } from '@/lib/cn';
import type { CaptionVariant } from '@/lib/store';

interface LiveCaptionProps {
  words: string[];
  style: CaptionVariant;
}

export default function LiveCaption({ words, style }: LiveCaptionProps) {
  const displayWords = words.slice(-8);

  if (style === 'karaoke') {
    return (
      <div className="text-center px-4">
        <p className="text-[length:var(--text-body-lg)] font-medium leading-relaxed">
          {displayWords.map((word, i) => (
            <span
              key={i}
              className={cn(
                'inline-block mr-2 transition-all duration-200',
                i === displayWords.length - 1
                  ? 'text-[--primary] scale-110 animate-popIn'
                  : 'text-white'
              )}
            >
              {word}
            </span>
          ))}
          <span className="inline-block w-0.5 h-5 bg-[--primary] animate-pulse ml-1" aria-hidden="true" />
        </p>
      </div>
    );
  }

  return (
    <div className={cn('px-4', style === 'center' && 'text-center')}>
      <p className="text-[length:var(--text-body-lg)] font-medium leading-relaxed text-white">
        {displayWords.join(' ')}
        <span className="inline-block w-0.5 h-5 bg-white/60 animate-pulse ml-1" aria-hidden="true" />
      </p>
    </div>
  );
}
