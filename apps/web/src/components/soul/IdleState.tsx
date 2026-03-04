'use client';

import type { ChangeEvent, RefObject } from 'react';
import { cn } from '@/lib/cn';
import WaveformDisplay from '@/components/primitives/waveform/WaveformDisplay';
import { ghostBtn, roundIconBtn } from '@/lib/variants';
import type { WaveformVariant } from '@/lib/store';

interface IdleStateProps {
  onStartRecording: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  canRecord: boolean;
  isLoading: boolean;
  waveformStyle: WaveformVariant;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export default function IdleState({
  onStartRecording,
  onFileUpload,
  canRecord,
  isLoading,
  waveformStyle,
  fileInputRef,
}: IdleStateProps) {
  return (
    <div className="flex flex-col items-center gap-8 sm:gap-10 animate-fadeIn w-full max-w-xs">
      <div className="text-center">
        <h1 className="text-[2.625rem] font-[200] tracking-[-0.04em] leading-none">
          ord<span className="text-blue-500 font-[300]">io</span>
        </h1>
        <p className="text-white/50 text-[0.6875rem] mt-2.5 tracking-[0.2em] uppercase">
          audio → video
        </p>
      </div>

      <WaveformDisplay variant={waveformStyle} level={0.2} isRecording={false} />

      <div className="h-10 flex items-center justify-center">
        <p className="text-white/40 text-sm">Your words will appear here</p>
      </div>

      <button
        onClick={onStartRecording}
        disabled={!canRecord && !isLoading}
        aria-label="Start recording"
        className={cn(
          roundIconBtn({ intent: 'idle' }),
          'disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2'
        )}
      >
        <span className="sr-only">Start recording</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[1.125rem] h-[1.125rem] rounded-full bg-[#e11d48]
                         group-hover:bg-red-400 transition-colors duration-150"
            aria-hidden="true"
          />
        </div>
      </button>

      <p className="text-white/40 text-[0.6875rem] tracking-[0.18em] uppercase">
        tap to record
      </p>

      <div>
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload audio file"
          className={cn(ghostBtn, 'underline underline-offset-4 decoration-white/20')}
        >
          or upload audio file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          aria-label="Audio file input"
          onChange={onFileUpload}
        />
      </div>
    </div>
  );
}
