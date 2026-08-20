'use client';

import dynamic from 'next/dynamic';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { captureNavBtn } from '@/lib/variants';
import type { CapturePhase } from '@/lib/capture/types';

const UserAvatarButton = dynamic(() => import('@/components/mobile/auth/UserAvatarButton'), {
  ssr: false,
  loading: () => <div className="w-8.5 h-8.5 rounded-full bg-white/10" />,
});

interface CaptureHeaderProps {
  phase: CapturePhase;
  onOpenFiles: () => void;
  onBack: () => void;
}

export function CaptureHeader({ phase, onOpenFiles, onBack }: CaptureHeaderProps) {
  const isIdle = phase === 'idle';

  return (
    <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4.5 z-20">
      <button
        type="button"
        onClick={isIdle ? onOpenFiles : onBack}
        className={captureNavBtn}
        aria-label={isIdle ? 'Your recordings' : 'Cancel and return to idle'}
      >
        {isIdle ? (
          <HugeiconsIcon icon={Menu01Icon} size={16} strokeWidth={2} />
        ) : (
          <HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={2} />
        )}
      </button>

      <div
        className="w-8.5 h-8.5 rounded-full transition-all duration-300"
        style={{
          opacity: isIdle ? 1 : 0,
          transform: isIdle ? 'scale(1)' : 'scale(0.6)',
          pointerEvents: isIdle ? 'auto' : 'none',
        }}
      >
        <UserAvatarButton />
      </div>
    </div>
  );
}
