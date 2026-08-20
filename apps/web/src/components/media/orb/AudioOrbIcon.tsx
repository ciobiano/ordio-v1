'use client';

import { cn } from '@/lib/utils';

interface AudioOrbIconProps {
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/**
 * The canonical "audio" mark: a lime radial-gradient circle with a dark mic
 * capsule + stand silhouette, breathing and glowing. Lifted from the desktop
 * studio's idle-state record button (Ordio Studio.dc.html) — the original
 * audio icon, kept identical wherever the app needs to represent audio/voice
 * rather than the flatter EQ-bar icon a later design pass swapped in.
 */
// Ratios preserve the source design's 150px orb (20×34 mic capsule, 14×14
// stand, stand sitting 30px below the circle).
export function AudioOrbIcon({ size = 56, className }: AudioOrbIconProps) {
  const micWidth = size * 0.1333;
  const micHeight = size * 0.2267;
  const standSize = size * 0.0933;
  const standOffset = size * 0.2;

  return (
    <span
      aria-hidden="true"
      className={cn('audio-orb-icon relative inline-flex shrink-0 items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 34% 28%, #D8FF6B, #C6FF3D 38%, #6BE0FF 100%)',
      }}
    >
      <span
        className="rounded-xl"
        style={{ width: micWidth, height: micHeight, background: 'rgba(10,11,10,0.82)' }}
      />
      <span
        className="absolute left-1/2"
        style={{
          bottom: -standOffset,
          width: standSize,
          height: standSize,
          transform: 'translateX(-50%)',
          borderLeft: '2px solid rgba(10,11,10,0.5)',
          borderRight: '2px solid rgba(10,11,10,0.5)',
        }}
      />
    </span>
  );
}
