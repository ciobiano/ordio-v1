import { cn } from '@/lib/utils'

interface OrdioMarkProps {
  size?: number
  color?: string
  /**
   * `assemble`: the page-transition loader — arcs slide out, then pulse.
   * `pulse`: already built, lime travels outward through the rings (in-screen progress).
   * `still`: the static mark.
   */
  motion?: 'assemble' | 'pulse' | 'still'
  className?: string
}

/**
 * The Ordio arcs mark: a centre circle with three arc pairs either side.
 *
 * Animated in CSS rather than framer-motion. The previous version started its
 * stagger from a useEffect, so nothing moved until hydration finished — by
 * which point a fast navigation had already removed the overlay it lived in,
 * and the loader was effectively never seen. CSS keyframes run from first
 * paint, server-rendered HTML included, and honour prefers-reduced-motion
 * without a JS branch.
 */
const ARCS = [
  { id: 'l1', d: 'M 380 166.48 A 100 100 0 0 0 380 333.52 Z' },
  { id: 'r1', d: 'M 620 166.48 A 100 100 0 0 1 620 333.52 Z' },
  { id: 'l2', d: 'M 315 178.59 A 100 100 0 0 0 315 321.41 Z' },
  { id: 'r2', d: 'M 685 178.59 A 100 100 0 0 1 685 321.41 Z' },
  { id: 'l3', d: 'M 265 197.32 A 100 100 0 0 0 265 302.68 Z' },
  { id: 'r3', d: 'M 735 197.32 A 100 100 0 0 1 735 302.68 Z' },
] as const

const RING: Record<(typeof ARCS)[number]['id'], 1 | 2 | 3> = { l1: 1, r1: 1, l2: 2, r2: 2, l3: 3, r3: 3 }

export function OrdioMark({ size = 80, color = 'currentColor', motion = 'assemble', className }: OrdioMarkProps) {
  const assemble = motion === 'assemble'
  const pulse = motion === 'pulse'
  return (
    <svg
      width={size}
      height={Math.round((size * 260) / 900)}
      // Cropped to the mark's own bounds so `size` is the drawn width.
      viewBox="50 120 900 260"
      fill={color}
      aria-hidden="true"
      className={cn(motion !== 'still' && 'ord-loader-mark', className)}
    >
      <path
        className={assemble ? 'ord-loader-core' : pulse ? 'ord-pulse-core' : undefined}
        d="M 500 150 A 100 100 0 1 0 500 350 A 100 100 0 1 0 500 150 Z"
      />
      {ARCS.map((arc) => (
        <path
          key={arc.id}
          data-arc={arc.id}
          data-ring={RING[arc.id]}
          className={assemble ? 'ord-loader-arc' : pulse ? 'ord-pulse-arc' : undefined}
          d={arc.d}
        />
      ))}
    </svg>
  )
}
