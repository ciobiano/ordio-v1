'use client';

import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

interface ProcessingStepProps {
  children: ReactNode;
  done: boolean;
  active: boolean;
}

const stepRoot = cva('flex items-center gap-3 transition-colors duration-200', {
  variants: {
    state: {
      done: 'text-[--accent-green]',
      active: 'text-white',
      pending: 'text-white/50',
    },
  },
  defaultVariants: { state: 'pending' },
});

export default function ProcessingStep({ children, done, active }: ProcessingStepProps) {
  const state = done ? 'done' : active ? 'active' : 'pending';

  return (
    <div className={cn(stepRoot({ state }))}>
      {done ? (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : active ? (
        <div className="w-4 h-4 shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      ) : (
        <div className="w-4 h-4 shrink-0 rounded-full border border-current opacity-50" aria-hidden="true" />
      )}
      <span className="text-sm">{children}</span>
    </div>
  );
}
