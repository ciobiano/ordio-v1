'use client';

import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SWIPE_THRESHOLD = 50;

const SLIDES = [
  {
    eyebrow: 'Record. Transcribe. Share.',
    headline: 'Turn your voice into a shareable story',
  },
  {
    eyebrow: 'Whisper-accurate captions',
    headline: 'Every word, time-stamped automatically',
  },
  {
    eyebrow: 'One tap to export',
    headline: 'Audiograms that actually look good',
  },
] as const;

interface Props {
  onCTA: () => void;
}

export function OnboardingCarousel({ onCTA }: Props) {
  const [slide, setSlide] = useState(0);
  const touchStartXRef = useRef(0);

  const advance = useCallback(() => {
    setSlide((s) => Math.min(s + 1, SLIDES.length - 1));
  }, []);

  const retreat = useCallback(() => {
    setSlide((s) => Math.max(s - 1, 0));
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const delta = e.changedTouches[0].clientX - touchStartXRef.current;
      if (delta < -SWIPE_THRESHOLD) advance();
      else if (delta > SWIPE_THRESHOLD) retreat();
    },
    [advance, retreat],
  );

  const current = SLIDES[slide];

  return (
    <div
      data-testid="carousel-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 flex flex-col gap-2"
    >
       {/* Hero text — left-aligned, lower-middle, cross-fade on slide change */}
       <AnimatePresence mode="sync">
         <motion.div
           key={slide}
           initial={{ opacity: 0, y: 12 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -8 }}
           transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
           className="absolute left-6 right-6"
           style={{ bottom: 'var(--splash-bottom)' }}
           aria-live="polite"
         >
           <p className="text-[length:var(--text-footnote)] uppercase tracking-[0.1em] text-white/45 font-medium mb-2">
             {current.eyebrow}
           </p>
           <h2 className="text-[length:var(--text-splash)] leading-[var(--leading-heading)] tracking-[-0.02em] text-white font-heading font-bold">
             {current.headline}
           </h2>
         </motion.div>
       </AnimatePresence>

      {/* Dash progress indicators — 44px touch targets wrapping visual dash */}
      <div className="absolute bottom-24 left-6 flex gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            data-testid="progress-dash"
            data-active={String(i === slide)}
            onClick={() => setSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === slide ? 'true' : undefined}
            className="h-11 flex items-center justify-center cursor-pointer"
          >
            <span
              className={[
                'block h-0.5 rounded-full transition-all duration-300',
                i === slide ? 'w-7 bg-white/90' : 'w-5 bg-white/20',
              ].join(' ')}
            />
          </button>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={onCTA}
        className="absolute bottom-7 left-4 right-4 h-14 bg-white text-black rounded-2xl
                   text-sm font-bold tracking-tight cursor-pointer
                   active:scale-[0.97] transition-transform duration-150"
      >
        Get Started
      </button>
    </div>
  );
}
