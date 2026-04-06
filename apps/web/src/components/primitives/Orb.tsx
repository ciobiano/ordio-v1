'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ✅ CLEAN DYNAMIC IMPORT - No workarounds needed!
const OrbCanvas = dynamic(() => import('./OrbCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-50 h-50 md:w-60 md:h-60 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20 animate-pulse" />
  ),
})

interface OrbProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
  onClick?: () => void
  ariaLabel?: string
  className?: string
  layoutId?: string
}

const breathe = {
  scale: [0.96, 1.04, 0.96],
  filter: [
    'drop-shadow(0 0 25px rgba(97,194,253,0.12))',
    'drop-shadow(0 0 50px rgba(97,194,253,0.35))',
    'drop-shadow(0 0 25px rgba(97,194,253,0.12))',
  ],
  transition: {
    duration: 8,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
}

export function Orb({ state, intensity, onClick, ariaLabel, className, layoutId }: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

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

  const activeAnimate = useMemo(() => ({
    scale: 1 + clampedIntensity * 0.08,
    filter: `drop-shadow(0 0 ${35 + clampedIntensity * 45}px rgba(97,194,253,${0.08 + clampedIntensity * 0.28}))`,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  }), [clampedIntensity])

  const animate = state === 'active'
    ? activeAnimate
    : state === 'dormant'
      ? breathe
      : undefined

  const orbContent = (
    <>
      <div
        data-state={state}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-7 rounded-full',
          state === 'dormant' && 'opacity-25',
          state === 'active'  && 'opacity-35',
          state === 'resting' && 'opacity-18',
        )}
      />

      {ripple && (
        <div
          className="absolute -inset-7 rounded-full border border-white/20 animate-ripple-out"
          onAnimationEnd={() => setRipple(false)}
        />
      )}

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