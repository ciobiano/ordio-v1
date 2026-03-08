'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { roundIconBtn } from '@/lib/variants';
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
  const { isPlaying, currentTime, duration, play, pause, seek } = playback;

  const handleToggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seek(Number(e.target.value));
    },
    [seek]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      {/* Play / Pause */}
      <button
        onClick={handleToggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={duration === 0}
        className={cn(
          roundIconBtn({ intent: isPlaying ? 'pause' : 'play' }),
          'disabled:opacity-30 disabled:cursor-not-allowed'
        )}
      >
        {isPlaying ? (
          /* Pause icon */
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          /* Play icon */
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Scrubber — 44px touch target, 3px visual track */}
      <div className="relative flex-1 h-11 flex items-center group">
        {/* Track background */}
        <div className="absolute left-0 right-0 h-0.75 rounded-full bg-white/10" />
        {/* Fill */}
        <div
          className="absolute left-0 h-0.75 rounded-full bg-gray-600 pointer-events-none"
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

      {/* Time display */}
      <span
        className="text-white/60 text-xs tabular-nums shrink-0 w-18 text-right"
        aria-live="off"
      >
        {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
      </span>
    </div>
  );
}
