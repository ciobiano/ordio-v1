'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

interface ScrubberProps {
  playback: UsePlaybackReturn;
}

/**
 * Seek track with a draggable head.
 *
 * The fill and the head are moved by writing to the DOM directly from the
 * playback time listener rather than by re-rendering — this sits next to a
 * canvas redrawing at 60fps, and a React render per frame is the one thing that
 * would make both stutter. `seek` only fires on pointer-up, so scrubbing is a
 * preview until you let go.
 */
export function Scrubber({ playback }: ScrubberProps) {
  const { currentTime, duration, seek, registerTimeListener } = playback;

  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const progressRef = useRef(0);

  const paint = useCallback((progress: number) => {
    if (fillRef.current) fillRef.current.style.width = `${progress * 100}%`;
    if (headRef.current) headRef.current.style.left = `${progress * 100}%`;
  }, []);

  useEffect(
    () =>
      registerTimeListener((time, total) => {
        if (draggingRef.current) return;
        paint(total > 0 ? time / total : 0);
      }),
    [registerTimeListener, paint]
  );

  const progressFromPointer = useCallback((event: React.PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (duration === 0) return;
      draggingRef.current = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      progressRef.current = progressFromPointer(event);
      paint(progressRef.current);
    },
    [duration, progressFromPointer, paint]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingRef.current || duration === 0) return;
      progressRef.current = progressFromPointer(event);
      paint(progressRef.current);
    },
    [duration, progressFromPointer, paint]
  );

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    seek(progressRef.current * duration);
  }, [seek, duration]);

  const initialProgress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek audio"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={duration === 0 ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'relative h-1.5 w-full cursor-pointer touch-none select-none rounded-full bg-white/[0.14]',
        duration === 0 && 'pointer-events-none cursor-default opacity-40'
      )}
    >
      <div
        ref={fillRef}
        className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--acid-accent)]"
        style={{ width: `${initialProgress * 100}%` }}
      />
      <div
        ref={headRef}
        aria-hidden="true"
        className={cn(
          'absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full',
          'border-[3px] border-[color:var(--acid-bg-base)] bg-[color:var(--acid-text-1)]'
        )}
        style={{ left: `${initialProgress * 100}%` }}
      />
    </div>
  );
}
