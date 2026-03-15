'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';

// Re-export so consumers can import the type from here
export type { UsePlaybackReturn };

interface PlaybackControlsProps {
  playback: ReturnType<typeof import('@/hooks/usePlayback').usePlayback>;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlaybackControls({ playback, className }: PlaybackControlsProps) {
  const { currentTime, duration, seek } = playback;

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seek(Number(e.target.value));
    },
    [seek]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      {/* Timestamps */}
      <span
        className="text-[--secondary] text-xs tabular-nums shrink-0"
        aria-live="off"
      >
        {formatTime(currentTime)}
      </span>

      {/* Scrubber — 44px touch target, 3px visual track */}
      <div className="relative flex-1 h-11 flex items-center">
        {/* Track background */}
        <div className="absolute left-0 right-0 h-0.75 rounded-full bg-[--surface]" />
        {/* Fill */}
        <div
          className="absolute left-0 h-0.75 rounded-full bg-[--primary] pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        {/* Range input (transparent — sits on top, full 44px height) */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleScrub}
          aria-label="Seek audio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          disabled={duration === 0}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {/* Total time */}
      <span
        className="text-[--secondary] text-xs tabular-nums shrink-0"
        aria-live="off"
      >
        {formatTime(duration)}
      </span>
    </div>
  );
}
