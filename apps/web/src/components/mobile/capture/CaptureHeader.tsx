'use client';

import dynamic from 'next/dynamic';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu01Icon, ArrowLeft01Icon, SlidersHorizontalIcon } from '@hugeicons/core-free-icons';
import { captureNavBtn } from '@/lib/variants';
import { cn } from '@/lib/utils';
import type { CapturePhase } from '@/lib/capture/types';

const UserAvatarButton = dynamic(() => import('@/components/mobile/auth/UserAvatarButton'), {
  ssr: false,
  loading: () => <div className="w-8.5 h-8.5 rounded-full bg-white/10" />,
});

interface CaptureHeaderProps {
  phase: CapturePhase;
  onOpenFiles: () => void;
  onBack: () => void;
  onOpenSettings: () => void;
}

/** The status pill: what the mic is doing, in one word. */
const PILL: Record<Exclude<CapturePhase, 'idle'>, { label: string; dot: string; tone: string }> = {
  recording: { label: 'REC', dot: 'bg-acid-error animate-pulse', tone: 'bg-acid-error/12 text-acid-error' },
  paused: { label: 'PAUSED', dot: 'bg-acid-warning', tone: 'bg-acid-warning/12 text-acid-warning' },
  ready: { label: 'READY', dot: 'bg-acid-accent', tone: 'bg-acid-text-1/8 text-acid-text-2' },
  processing: { label: 'PROCESSING', dot: 'bg-acid-accent', tone: 'bg-acid-text-1/8 text-acid-text-2' },
};

export function CaptureHeader({ phase, onOpenFiles, onBack, onOpenSettings }: CaptureHeaderProps) {
  if (phase === 'idle') {
    return (
      <header className="flex h-16 shrink-0 items-center justify-between px-4">
        <button type="button" onClick={onOpenFiles} className={captureNavBtn} aria-label="Your recordings">
          <HugeiconsIcon icon={Menu01Icon} size={16} strokeWidth={2} />
        </button>
        <div className="w-8.5 h-8.5 rounded-full">
          <UserAvatarButton />
        </div>
      </header>
    );
  }

  const pill = PILL[phase];
  // Settings change how the *next* take is captured; mid-take they would only
  // mislead, so the slot is kept (the pill stays centred) but not offered.
  const canOpenSettings = phase === 'ready';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-4">
      <button type="button" onClick={onBack} className={captureNavBtn} aria-label="Cancel and return to idle">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
      </button>

      <div className={cn('flex h-8 items-center gap-2 rounded-full px-3', pill.tone)}>
        <span className={cn('h-2 w-2 rounded-full', pill.dot)} aria-hidden="true" />
        <span className="font-acid-mono text-xs tracking-widest">{pill.label}</span>
      </div>

      {canOpenSettings ? (
        <button type="button" onClick={onOpenSettings} className={captureNavBtn} aria-label="Recording settings">
          <HugeiconsIcon icon={SlidersHorizontalIcon} size={16} strokeWidth={2} />
        </button>
      ) : (
        <span className="w-11" aria-hidden="true" />
      )}
    </header>
  );
}
