'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface LockBadgeProps {
  onClick: (e?: React.MouseEvent) => void;
  label?: string;
}

/**
 * Small padlock overlay for locked features.
 * Parent must have `position: relative`.
 */
export default function LockBadge({ onClick, label = 'Locked feature' }: LockBadgeProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={label}
      className="absolute inset-0 h-auto w-auto rounded-inherit
                 flex items-center justify-center hover:bg-transparent group"
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full
                   bg-black/50 backdrop-blur-sm border border-white/20
                   group-hover:bg-black/70 transition-colors duration-150"
        aria-hidden="true"
      >
        <Image src="/icons/lock.svg" width={10} height={10} alt="" aria-hidden="true" className="invert opacity-70" />
      </span>
    </Button>
  );
}
