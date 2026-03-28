'use client';

import { useState, useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 50; // px

const SLIDES = [
  {
    eyebrow: 'Welcome to',
    headlineStart: 'Next-level',
    headlineBold: 'audio',
    headlineEnd: 'creation',
  },
  {
    eyebrow: 'Auto-transcribe, instantly',
    headlineStart: 'Your words,',
    headlineBold: 'perfectly',
    headlineEnd: 'timed',
  },
  {
    eyebrow: 'Share in seconds',
    headlineStart: 'Beautiful',
    headlineBold: 'audiograms',
    headlineEnd: '',
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
      className="absolute inset-0 flex flex-col"
    >
      {/* Hero text — left-aligned, lower-middle */}
      <div className="absolute bottom-32 left-6 right-6" aria-live="polite">
        <p className="text-xs text-white/45 mb-1.5 tracking-wide">
          {current.eyebrow}
        </p>
        <h2 className="text-3xl font-light leading-snug tracking-tight text-white">
          {current.headlineStart}
          <br />
          <strong className="font-bold">{current.headlineBold}</strong>
          {current.headlineEnd ? ` ${current.headlineEnd}` : null}
        </h2>
      </div>

      {/* Dash progress indicators */}
      <div className="absolute bottom-28 left-6 flex gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            data-testid="progress-dash"
            data-active={String(i === slide)}
            onClick={() => setSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === slide ? 'true' : undefined}
            className={[
              'h-0.5 rounded-full transition-all duration-300',
              i === slide ? 'w-7 bg-white/90' : 'w-5 bg-white/20',
            ].join(' ')}
          />
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={onCTA}
        className="absolute bottom-7 left-4 right-4 h-14 bg-white text-black rounded-2xl
                   text-sm font-bold tracking-tight
                   active:scale-95 transition-transform duration-100"
      >
        Get Started
      </button>
    </div>
  );
}
