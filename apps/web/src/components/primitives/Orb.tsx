'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// Lazy-load the R3F canvas — defers the ~200KB Three.js chunk until needed
const OrbCanvas = dynamic(() => import('./OrbCanvas').then((m) => m.OrbCanvas), {
  ssr: false,
  loading: () => null,
})

interface OrbProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
  onClick?: () => void
  ariaLabel?: string
  className?: string
  layoutId?: string
}

/** Idle screen — slow, meditative heartbeat */
const breathe = {
  scale: [0.95, 1.05, 0.95],
  filter: [
    'drop-shadow(0 0 30px rgba(100,180,255,0.15))',
    'drop-shadow(0 0 60px rgba(100,180,255,0.40))',
    'drop-shadow(0 0 30px rgba(100,180,255,0.15))',
  ],
  transition: {
    duration: 8,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
}

export function Orb({ state, intensity, onClick, ariaLabel, className, layoutId }: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

  // Idle invitation: ripple pulse after 3s of dormant state
  const [ripple, setRipple] = useState(false)
  useEffect(() => {
    if (state !== 'dormant') {
      setRipple(false)
      return
    }
    const t = setTimeout(() => setRipple(true), 3000)
    return () => clearTimeout(t)
  }, [state])

  const handlePointerDown = useCallback(() => {
    navigator.vibrate?.(15)
  }, [])

  /** Recording — orb reacts to voice */
  const activeAnimate = useMemo(() => ({
    scale: 1 + clampedIntensity * 0.1,
    filter: `drop-shadow(0 0 ${20 + clampedIntensity * 50}px rgba(100,180,255,${0.1 + clampedIntensity * 0.3}))`,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  }), [clampedIntensity])

  const animate = state === 'active'
    ? activeAnimate
    : state === 'dormant'
      ? breathe
      : undefined

  const orbContent = (
    <>
      {/* Outer glow ring */}
      <div
        data-state={state}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-7 rounded-full',
          state === 'dormant' && 'opacity-30',
          state === 'active'  && 'opacity-40',
          state === 'resting' && 'opacity-20',
        )}
      />

      {/* Idle invitation — ripple ring expands outward */}
      {ripple && (
        <div
          className="absolute -inset-7 rounded-full border border-white/20 animate-ripple-out"
          onAnimationEnd={() => setRipple(false)}
        />
      )}

      {/* 3D orb canvas — clipped to circle by parent overflow-hidden */}
      <div
        data-state={state}
        className={cn(
          'orb-core relative z-10 w-50 h-50 md:w-60 md:h-60 clip-circle',
          state === 'resting' && 'scale-95 opacity-70',
        )}
      >
        <OrbCanvas state={state} intensity={clampedIntensity} />
      </div>
    </>
  )

  const sharedClassName = cn('relative flex items-center justify-center', className)
  const motionProps = {
    layoutId,
    animate,
    className: sharedClassName,
    style: { '--orb-intensity': clampedIntensity } as React.CSSProperties,
  }

  if (onClick) {
    return (
      <motion.button
        {...motionProps}
        data-state={state}
        type="button"
        onClick={onClick}
        onPointerDown={handlePointerDown}
        aria-label={ariaLabel}
      >
        {orbContent}
      </motion.button>
    )
  }

  return (
    <motion.div
      {...motionProps}
      data-state={state}
    >
      {orbContent}
    </motion.div>
  )
}
