'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft } from 'griddy-icons';
import { captureNavBtn } from '@/lib/variants';
import type { CapturePhase } from './types';

const UserAvatarButton = dynamic(() => import('@/components/soul/auth/UserAvatarButton'), {
  ssr: false,
  loading: () => <div className="w-8.5 h-8.5 rounded-full bg-white/10" />,
});

interface CaptureHeaderProps {
  phase: CapturePhase;
  onBack: () => void;
}

/**
 * Idle has no left-side button — matches the deployed reference (only the avatar, top-right,
 * plus the separate SavedAudioPanel FAB elsewhere on screen). Every other phase shows a plain
 * back arrow that resets to idle; the avatar hides once a recording is in progress.
 */
export function CaptureHeader({ phase, onBack }: CaptureHeaderProps) {
  const isIdle = phase === 'idle';

  return (
    <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4.5 z-20">
      <div className="w-10 h-10">
        {!isIdle && (
          <button type="button" onClick={onBack} className={captureNavBtn} aria-label="Cancel and return to idle">
            <ArrowLeft size={20} />
          </button>
        )}
      </div>

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
