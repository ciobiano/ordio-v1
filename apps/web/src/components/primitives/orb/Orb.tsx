'use client';

import { useMemo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

const OrbCanvas = dynamic(() => import('./OrbCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-50 h-50 md:w-60 md:h-60 rounded-full bg-[radial-gradient(circle_at_38%_28%,rgba(240,248,255,0.9)_0%,rgba(120,194,246,0.72)_34%,rgba(24,128,245,0.9)_100%)] opacity-74" />
  ),
});

interface OrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'dormant' | 'active' | 'resting';
  intensity: number;
  isSpeaking?: boolean;
  onClick?: () => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  ariaLabel?: string;
  className?: string;
  layoutId?: string;
}

const breathe = {
  scale: [0.992, 1.008, 0.992],
  opacity: [0.9, 1, 0.9],
  transition: {
    duration: 6,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
};

export function Orb({
  state,
  intensity,
  isSpeaking,
  onClick,
  onPressStart,
  onPressEnd,
  ariaLabel,
  className,
  layoutId,
}: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const [isPressed, setIsPressed] = useState(false);
  const { trigger } = useHaptics();
  const reducedMotion = useReducedMotion();
  const phase = state === 'dormant'
    ? 'idle'
    : state === 'active'
      ? (isSpeaking ? 'speaking' : 'listening')
      : state === 'resting'
        ? 'thinking'
        : state;

  const handlePointerDown = useCallback(() => {
    setIsPressed(true);
    trigger('medium');
    onPressStart?.();
  }, [onPressStart, trigger]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    onPressEnd?.();
  }, [onPressEnd]);

  // Enhanced glow when speaking — more prominent rim
  const speakingBoost = phase === 'speaking' ? 0.12 : 0;
  const activeAnimate = useMemo(
    () => ({
      scale: 1 + clampedIntensity * 0.03,
      transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
    }),
    [clampedIntensity, speakingBoost]
  );

  const animate = phase === 'speaking' || phase === 'listening'
    ? activeAnimate
    : (phase === 'idle' && !reducedMotion)
      ? breathe
      : undefined;

  const orbContent = (
    <>
      <div
        data-state={state}
        data-phase={phase}
        data-speaking={isSpeaking}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-4 rounded-full pointer-events-none transition-all duration-300',
          phase === 'idle' && 'opacity-14',
          phase === 'listening' && 'opacity-20',
          phase === 'speaking' && 'opacity-30',
          phase === 'thinking' && 'opacity-16',
          isPressed && 'opacity-36'
        )}
      />

      <div
        data-state={state}
        data-phase={phase}
        className={cn(
          'orb-core relative z-10 w-50 h-50 md:w-60 md:h-60 clip-circle',
          phase === 'thinking' && 'scale-97 opacity-80'
        )}
      >
        <OrbCanvas state={phase} intensity={clampedIntensity} isSpeaking={isSpeaking} />
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
