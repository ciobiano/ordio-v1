'use client';

import { cva } from 'class-variance-authority';

export const captionRow = cva(
  'group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-100 cursor-pointer border-l-2 outline-none min-h-[52px] focus-visible:ring-1 focus-visible:ring-ring/50',
  {
    variants: {
      state: {
        idle: 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
        active: 'border-accent text-foreground bg-accent/5',
        selected: 'border-white/20 text-foreground bg-white/',
      },
    },
    defaultVariants: { state: 'idle' },
  }
);

export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

