'use client'

import { cn } from '@/lib/cn'

interface OrbProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
  onClick?: () => void
  ariaLabel?: string
  className?: string
}

export function Orb({ state, intensity, onClick, ariaLabel, className }: OrbProps) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

  const content = (
    <>
      {/* Outer glow ring — opacity driven by intensity in active state */}
      <div
        className={cn(
          'absolute -inset-7 rounded-full transition-opacity duration-600',
          state === 'dormant' && 'opacity-30',
          state === 'resting' && 'opacity-20'
        )}
        style={{
          background:
            'radial-gradient(circle, rgba(255,180,200,0.15) 0%, transparent 70%)',
          opacity: state === 'active' ? 0.6 + clampedIntensity * 0.4 : undefined,
        }}
      />

      {/* Core orb */}
      <div
        className={cn(
          'relative z-10 w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full overflow-hidden transition-all duration-600',
          state === 'dormant' && 'animate-[orbBreathe_6s_ease-in-out_infinite]',
          state === 'resting' && 'scale-95 opacity-70'
        )}
        style={{
          boxShadow:
            state === 'active'
              ? `0 0 ${40 + clampedIntensity * 40}px rgba(255,180,200,${0.1 + clampedIntensity * 0.15}), 0 0 ${60 + clampedIntensity * 60}px rgba(120,200,220,${0.05 + clampedIntensity * 0.08})`
              : '0 0 30px rgba(255,180,200,0.1)',
          transform: state === 'active' ? `scale(${1 + clampedIntensity * 0.12})` : undefined,
        }}
      >
        {/* Rotating iridescent gradient */}
        <div
          className={cn(
            'absolute -inset-5 rounded-full',
            state === 'dormant' && 'animate-[orbRotate_12s_linear_infinite]',
            state === 'active' && 'animate-[orbRotate_4s_linear_infinite]',
            state === 'resting' && 'animate-none'
          )}
          style={{
            background:
              'conic-gradient(from 0deg, rgba(255,190,210,0.7), rgba(160,220,230,0.6), rgba(255,200,170,0.7), rgba(200,180,240,0.5), rgba(255,190,210,0.7))',
            filter: state === 'resting' ? 'blur(24px)' : state === 'dormant' ? 'blur(22px)' : 'blur(18px)',
          }}
        />

        {/* Specular highlight for 3D depth */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
          }}
        />

        {/* Glass rim */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid rgba(255,255,255,0.15)' }}
        />
      </div>
    </>
  )

  const sharedProps = {
    'data-state': state,
    className: cn('relative flex items-center justify-center', className),
    style: { '--orb-intensity': clampedIntensity } as React.CSSProperties,
  }

  if (onClick) {
    return (
      <button {...sharedProps} onClick={onClick} aria-label={ariaLabel} type="button">
        {content}
      </button>
    )
  }

  return <div {...sharedProps}>{content}</div>
}
