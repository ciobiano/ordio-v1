'use client';

import type { ChangeEvent, RefObject } from 'react';
import { Orb } from '@/components/primitives/Orb';
import { Button } from '@/components/ui/button';

interface IdleStateProps {
  onStartRecording: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  canRecord: boolean;
  isLoading: boolean;
  micDenied?: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export function IdleState({
  onStartRecording,
  onFileUpload,
  canRecord,
  isLoading,
  micDenied = false,
  fileInputRef,
}: IdleStateProps) {
  const orbState = isLoading ? 'resting' : micDenied ? 'resting' : 'dormant';

  let statusLabel: string;
  if (isLoading) {
    statusLabel = 'Preparing microphone\u2026';
  } else if (micDenied) {
    statusLabel = 'Microphone access denied';
  } else {
    statusLabel = 'Tap to record';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fadeIn">
      {/* Wordmark */}
      <p className="text-white/50 text-2xl font-light tracking-wide mb-8">
        ord<span className="font-medium">io</span>
      </p>

      {/* Orb — primary CTA */}
      <Orb
        state={orbState}
        intensity={isLoading ? 0.4 : 0}
        onClick={canRecord && !isLoading && !micDenied ? onStartRecording : undefined}
        ariaLabel="Start recording"
        layoutId="orb"
      />

      {/* Status label sits directly below the orb */}
      <p className={micDenied ? 'text-white/45 text-sm font-medium' : 'text-white text-sm font-medium'}>
        {statusLabel}
      </p>

      {/* Mic-denied fix link */}
      {micDenied && (
        <a
          href="https://support.google.com/chrome/answer/2693767"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 text-xs underline underline-offset-2 -mt-2 hover:text-white/50 transition-colors"
        >
          How to fix &rarr;
        </a>
      )}

      {/* Upload option */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="text-white/30 text-xs hover:text-white/50 hover:bg-transparent transition-colors mt-2 h-auto py-1"
      >
        or upload audio
      </Button>
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
