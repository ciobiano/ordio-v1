'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { Orb } from '@/components/primitives/orb/Orb';
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
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedFromHoldRef = useRef(false);

  const orbState = isLoading ? 'resting' : micDenied ? 'resting' : 'dormant';

  let statusLabel: string;
  if (isLoading) {
    statusLabel = 'Preparing microphone\u2026';
  } else if (micDenied) {
    statusLabel = 'Microphone access denied';
  } else {
    statusLabel = 'Press and hold to record';
  }

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handlePressStart = useCallback(() => {
    if (!canRecord || isLoading || micDenied) return;
    startedFromHoldRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      startedFromHoldRef.current = true;
      onStartRecording();
    }, 220);
  }, [canRecord, clearHoldTimer, isLoading, micDenied, onStartRecording]);

  const handlePressEnd = useCallback(() => {
    clearHoldTimer();
  }, [clearHoldTimer]);

  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const handleClick = useCallback(() => {
    if (!canRecord || isLoading || micDenied) return;
    if (startedFromHoldRef.current) {
      startedFromHoldRef.current = false;
      return;
    }
    onStartRecording();
  }, [canRecord, isLoading, micDenied, onStartRecording]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fadeIn py-10">
      <p className="text-white/45 text-2xl font-light tracking-tight mb-8">
        ord<span className="font-medium">io</span>
      </p>

      <Orb
        state={orbState}
        intensity={isLoading ? 0.35 : 0}
        onClick={handleClick}
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
        ariaLabel="Start recording"
        layoutId="orb"
      />

      <p className={micDenied ? 'text-white/45 text-sm' : 'text-white/60 text-sm'}>{statusLabel}</p>

      {micDenied && (
        <a
          href="https://support.google.com/chrome/answer/2693767"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/35 text-xs underline underline-offset-2 hover:text-white/55 transition-colors"
        >
          How to fix &rarr;
        </a>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="text-white/35 text-xs hover:text-white/55 hover:bg-transparent transition-colors mt-2 h-auto py-1"
      >
        or upload audio or video
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4a"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  );
}

export default IdleState;
