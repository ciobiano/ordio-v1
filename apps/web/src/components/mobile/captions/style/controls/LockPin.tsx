'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { SquareLock02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ordLockBadge } from '@/lib/variants';

interface LockPinProps {
  size?: 'sm' | 'md';
  position?: 'tile' | 'card' | 'float';
  className?: string;
}

/**
 * Decorative rose padlock pinned to the corner of a gated control.
 *
 * Deliberately NOT interactive, unlike `components/ui/LockBadge`, which covers
 * its parent with `absolute inset-0` and swallows the click. That older pattern
 * is what let a free user apply a locked aspect ratio by tapping the button body
 * instead of the badge — the design fixes this by gating the control itself, so
 * the pin only needs to mark the state.
 *
 * The control that owns this pin is responsible for calling the gate.
 */
export function LockPin({ size = 'sm', position = 'tile', className }: LockPinProps) {
  return (
    <span aria-hidden="true" className={cn(ordLockBadge({ size, position }), className)}>
      <HugeiconsIcon icon={SquareLock02Icon} size={size === 'md' ? 11 : 9} strokeWidth={3} />
    </span>
  );
}
