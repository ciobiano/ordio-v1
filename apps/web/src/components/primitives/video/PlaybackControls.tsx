'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

export type { UsePlaybackReturn };

interface PlaybackControlsProps {
  playback: UsePlaybackReturn;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlaybackControls({ playback, className }: PlaybackControlsProps) {
  const { currentTime, duration, seek, registerTimeListener } = playback;

  const fillRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragProgressRef = useRef(0);

  // Hot path: update fill and time label directly via DOM — no React re-render per frame
  useEffect(() => {
    return registerTimeListener((t, d) => {
      if (isDraggingRef.current) return;
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${d > 0 ? t / d : 0})`;
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatTime(t);
      }
    });
  }, [registerTimeListener]);

  const getProgressFromPointer = useCallback((e: React.PointerEvent): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (duration === 0) return;
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const progress = getProgressFromPointer(e);
      dragProgressRef.current = progress;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(progress * duration);
    },
    [duration, getProgressFromPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || duration === 0) return;
      const progress = getProgressFromPointer(e);
      dragProgressRef.current = progress;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(progress * duration);
    },
    [duration, getProgressFromPointer]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    seek(dragProgressRef.current * duration);
  }, [seek, duration]);

  const initialProgress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <span
        ref={timeDisplayRef}
        className="text-muted-foreground text-xs tabular-nums shrink-0"
        aria-live="off"
      >
        {formatTime(currentTime)}
      </span>

      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-label="Seek audio"
        tabIndex={duration === 0 ? -1 : 0}
        className={cn(
          'relative flex-1 h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer touch-none select-none',
          duration === 0 && 'opacity-40 cursor-default pointer-events-none'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 w-full bg-primary origin-left"
          style={{ transform: `scaleX(${initialProgress})` }}
        />
      </div>

      <span className="text-muted-foreground text-xs tabular-nums shrink-0" aria-live="off">
        {formatTime(duration)}
      </span>
    </div>
  );
}
