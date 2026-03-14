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
      {/* Outer glow ring — opacity driven by CSS calc in active state */}
      <div
        data-state={state}
        className={cn(
          'orb-glow orb-glow-ring absolute -inset-7 rounded-full transition-opacity duration-600',
          state === 'dormant' && 'opacity-30',
          state === 'resting' && 'opacity-20'
        )}
      />

      {/* Core orb */}
      <div
        data-state={state}
        className={cn(
          'orb-core relative z-10 w-50 h-50 md:w-60 md:h-60 rounded-full overflow-hidden transition-all duration-600',
          state === 'dormant' && 'animate-[orbBreathe_6s_ease-in-out_infinite]',
          state === 'resting' && 'scale-95 opacity-70'
        )}
      >
        {/* Rotating iridescent gradient */}
        <div
          className={cn(
            'orb-gradient absolute -inset-5 rounded-full',
            state === 'dormant' && 'animate-[orbRotate_12s_linear_infinite] blur-[22px]',
            state === 'active' && 'animate-[orbRotate_4s_linear_infinite] blur-[18px]',
            state === 'resting' && 'animate-none blur-[24px]'
          )}
        />

        {/* Specular highlight for 3D depth */}
        <div className="orb-specular absolute inset-0 rounded-full" />

        {/* Glass rim */}
        <div className="orb-rim absolute inset-0 rounded-full" />
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
