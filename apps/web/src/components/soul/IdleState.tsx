'use client';

import type { ChangeEvent, RefObject } from 'react';
import { Orb } from '@/components/primitives/Orb';

interface IdleStateProps {
  onStartRecording: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  canRecord: boolean;
  isLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export function IdleState({
  onStartRecording,
  onFileUpload,
  canRecord,
  isLoading,
  fileInputRef,
}: IdleStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fadeIn">
      {/* Wordmark */}
      <p className="text-[--secondary] text-[length:var(--text-body-sm)] font-light tracking-wide mb-8">
        ord<span className="font-medium">io</span>
      </p>

      {/* Dormant orb — tap to record */}
      <Orb
        state="dormant"
        intensity={0}
        onClick={canRecord && !isLoading ? onStartRecording : undefined}
        ariaLabel="Start recording"
      />

      {/* Mic icon hint */}
      <svg
        className="w-5 h-5 text-[--secondary] mt-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>

      <p className="text-[--primary] text-[length:var(--text-body)] font-medium">Tap to record</p>

      {/* Upload option */}
      <button
        type="button"
        className="text-[--secondary] text-[length:var(--text-caption)] hover:text-[--primary] transition-colors mt-2"
        onClick={() => fileInputRef.current?.click()}
      >
        or upload audio
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  );
}

export default IdleState;
