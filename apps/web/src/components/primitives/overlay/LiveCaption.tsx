'use client';

import { cn } from '@/lib/utils';
import type { CaptionMode } from '@/stores';

/** Number of trailing words to display at once. */
const MAX_WORDS = 8;

interface LiveCaptionProps {
  words: string[];
  style: CaptionMode;
}

export default function LiveCaption({ words, style }: LiveCaptionProps) {
  const displayWords = words.slice(-MAX_WORDS);

  // Use each word's absolute position in the full transcript as its key.
  // This keeps keys stable when new words arrive — only the incoming word
  // gets a fresh key and triggers its entrance animation; older words don't
  // re-mount or re-animate unnecessarily.
  const startIdx = words.length - displayWords.length;

  if (style === 'karaoke') {
    return (
      <div className="text-center px-4">
        <p className="text-lg font-medium leading-relaxed">
          {displayWords.map((word, i) => {
            const isLatest = i === displayWords.length - 1;
            // Older words fade progressively: 10% opacity reduction per step,
            // floored at 35% so nothing disappears entirely.
            const opacity = isLatest ? 1 : Math.max(0.35, 1 - (displayWords.length - 1 - i) * 0.1);

            return (
              <span
                key={startIdx + i}
                className={cn(
                  'inline-block mr-2 transition-all duration-300 animate-popIn',
                  isLatest
                    ? 'text-primary scale-110 drop-shadow-[0_0_8px_rgba(97,194,253,0.55)]'
                    : 'text-white'
                )}
                style={{ opacity }}
              >
                {word}
              </span>
            );
          })}
          <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-1" aria-hidden="true" />
        </p>
      </div>
    );
  }

  // Phrase mode — render words individually so only the new arrival animates.
  return (
    <div className="px-4">
      <p className="text-lg font-medium leading-relaxed text-white">
        {displayWords.map((word, i) => {
          const isLatest = i === displayWords.length - 1;
          return (
            <span
              key={startIdx + i}
              className={cn('inline-block mr-1.5', isLatest && 'animate-popIn')}
            >
              {word}
            </span>
          );
        })}
        <span className="inline-block w-0.5 h-5 bg-white/60 animate-pulse ml-1" aria-hidden="true" />
      </p>
    </div>
  );
}
