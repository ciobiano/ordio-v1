'use client';

import { useMemo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const OrbCanvas = dynamic(() => import('./OrbCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-50 h-50 md:w-60 md:h-60 rounded-full bg-[radial-gradient(circle_at_38%_28%,rgba(240,248,255,0.9)_0%,rgba(120,194,246,0.72)_34%,rgba(24,128,245,0.9)_100%)] animate-pulse" />
  ),
});

interface OrbProps {
  state: 'dormant' | 'active' | 'resting';
  intensity: number;
  isSpeaking?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  layoutId?: string;
}

const breathe = {
  scale: [0.985, 1.015, 0.985],
  filter: [
    'drop-shadow(0 0 14px rgba(97,194,253,0.09))',
    'drop-shadow(0 0 24px rgba(97,194,253,0.16))',
    'drop-shadow(0 0 14px rgba(97,194,253,0.09))',
  ],
  transition: {
    duration: 8,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
};

export function Orb({
  state,
  intensity,
  isSpeaking,
  onClick,
  ariaLabel,
  className,
  layoutId,
}: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = useCallback(() => {
    setIsPressed(true);
    navigator.vibrate?.(15);
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Enhanced glow when speaking — more prominent rim
  const speakingBoost = isSpeaking ? 0.15 : 0;
  const activeAnimate = useMemo(
    () => ({
      scale: 1 + clampedIntensity * 0.05,
      filter: `drop-shadow(0 0 ${22 + clampedIntensity * 30}px rgba(97,194,253,${0.07 + clampedIntensity * 0.22 + speakingBoost}))`,
      transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
    }),
    [clampedIntensity, speakingBoost]
  );

  const animate = state === 'active' ? activeAnimate : state === 'dormant' ? breathe : undefined;

  const orbContent = (
    <>
      <div
        data-state={state}
        data-speaking={isSpeaking}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-4 rounded-full pointer-events-none transition-all duration-300',
          state === 'dormant' && 'opacity-18',
          state === 'active' && isSpeaking && 'opacity-34 shadow-[0_0_36px_rgba(97,194,253,0.26)]',
          state === 'active' && !isSpeaking && 'opacity-24',
          state === 'resting' && 'opacity-12',
          isPressed && 'opacity-36'
        )}
      />

      <div
        data-state={state}
        className={cn(
          'orb-core relative z-10 w-50 h-50 md:w-60 md:h-60 clip-circle',
          state === 'resting' && 'scale-95 opacity-74'
        )}
      >
        <OrbCanvas state={state} intensity={clampedIntensity} isSpeaking={isSpeaking} />
      </div>
    </>
  );

  const sharedClassName = cn(
    'relative flex items-center justify-center overflow-visible',
    className
  );
  const motionProps = {
    layoutId,
    animate,
    className: sharedClassName,
    style: { '--orb-intensity': clampedIntensity } as React.CSSProperties,
  };

  if (onClick) {
    return (
      <motion.button
        {...motionProps}
        data-state={state}
        type="button"
        onClick={onClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        whileTap={{
          scale: 0.975,
          transition: { duration: 0.09, ease: 'easeOut' },
        }}
        aria-label={ariaLabel}
      >
        {orbContent}
      </motion.button>
    );
  }

  return (
    <motion.div {...motionProps} data-state={state}>
      {orbContent}
    </motion.div>
  );
}
