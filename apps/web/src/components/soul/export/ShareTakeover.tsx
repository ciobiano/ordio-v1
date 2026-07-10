// apps/web/src/components/soul/export/ShareTakeover.tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { acidPill } from '@/lib/variants';
import { ShareCard, type ShareCardVariant } from './ShareCard';

interface ShareTakeoverProps {
  isVisible: boolean;
  headline: string;
  durationSeconds: number;
}

const VARIANTS: ShareCardVariant[] = ['acid', 'sunset', 'electric'];
const EASE = [0.32, 0.72, 0, 1] as const;

export function ShareTakeover({ isVisible, headline, durationSeconds }: ShareTakeoverProps) {
  const [variant, setVariant] = useState<ShareCardVariant>('acid');

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black px-6 pb-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.36, ease: EASE }}
        >
          <div className="w-full max-w-[240px]">
            <ShareCard headline={headline} durationSeconds={durationSeconds} variant={variant} />
          </div>

          <div className="flex gap-1.5 rounded-acid-md bg-acid-surface-1 p-1" role="tablist" aria-label="Share card color">
            {VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={variant === v}
                onClick={() => setVariant(v)}
                className={acidPill({ active: variant === v })}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
