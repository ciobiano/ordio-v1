'use client';

import Image from 'next/image';
import type { ChangeEvent, RefObject } from 'react';
import { Orb } from '@/components/primitives/Orb';
import { Button } from '@/components/ui/button';

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
      <p className="text-muted-foreground text-2xl font-light tracking-wide mb-8">
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
      <Image src="/icons/mic.svg" width={20} height={20} alt="" aria-hidden="true" className="invert opacity-50 mt-2" />

      <p className="text-foreground text-sm font-medium">Tap to record</p>

      {/* Upload option */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="text-muted-foreground text-xs hover:text-foreground hover:bg-transparent transition-colors mt-2 h-auto py-1"
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
