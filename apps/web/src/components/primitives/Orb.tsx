'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface OrbProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
  onClick?: () => void
  ariaLabel?: string
  className?: string
}

/** Idle screen — slow, meditative heartbeat */
const breathe = {
  scale: [0.95, 1.05, 0.95],
  filter: [
    'drop-shadow(0 0 30px rgba(255,180,200,0.15))',
    'drop-shadow(0 0 60px rgba(255,180,200,0.35))',
    'drop-shadow(0 0 30px rgba(255,180,200,0.15))',
  ],
  transition: {
    duration: 8,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
}

export function Orb({ state, intensity, onClick, ariaLabel, className }: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

  /** Recording — orb reacts to voice: still when silent, alive when speaking */
  const activeAnimate = useMemo(() => ({
    scale: 1 + clampedIntensity * 0.1,
    filter: `drop-shadow(0 0 ${20 + clampedIntensity * 50}px rgba(255,180,200,${0.1 + clampedIntensity * 0.3}))`,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  }), [clampedIntensity])

  const animate = state === 'active'
    ? activeAnimate
    : state === 'dormant'
      ? breathe
      : undefined

  const content = (
    <>
      {/* Outer glow ring */}
      <div
        data-state={state}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-7 rounded-full',
          state === 'dormant' && 'opacity-30',
          state === 'active' && 'opacity-40',
          state === 'resting' && 'opacity-20'
        )}
      />

      {/* Core orb */}
      <div
        data-state={state}
        className={cn(
          'orb-core relative z-10 w-50 h-50 md:w-60 md:h-60 rounded-full overflow-hidden',
          state === 'resting' && 'scale-95 opacity-70'
        )}
      >
        {/* Iridescent gradient — blur softens the conic bands */}
        <div
          className={cn(
            'orb-gradient absolute -inset-5 rounded-full',
            state === 'active' && 'blur-[18px]',
            state === 'dormant' && 'blur-[22px]',
            state === 'resting' && 'blur-[24px]'
          )}
        />

        {/* Specular highlight for 3D depth */}
        <div className="orb-specular absolute inset-0 rounded-full" />

        {/* Glass rim */}
        <div className="orb-rim absolute inset-0 rounded-full" />
      </div>
    </>
  )

  const sharedClassName = cn('relative flex items-center justify-center', className)

  if (onClick) {
    return (
      <motion.button
        data-state={state}
        className={sharedClassName}
        style={{ '--orb-intensity': clampedIntensity } as React.CSSProperties}
        animate={animate}
        onClick={onClick}
        aria-label={ariaLabel}
        type="button"
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      data-state={state}
      className={sharedClassName}
      style={{ '--orb-intensity': clampedIntensity } as React.CSSProperties}
      animate={animate}
    >
      {content}
    </motion.div>
  )
}
