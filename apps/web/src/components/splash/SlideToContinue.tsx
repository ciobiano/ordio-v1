'use client';

import { useRef, useState, useCallback } from 'react';
import { useHaptics } from '@/hooks/useHaptics';

const THUMB_SIZE = 36; // matches w-9 (Tailwind = 9 * 4px = 36px)
const COMPLETE_THRESHOLD = 0.85;
const THUMB_INSET = 7; // px from left edge when at rest

interface Props {
  onComplete: () => void;
}

export function SlideToContinue({ onComplete }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const progressRef = useRef(0);
  const thumbLeftRef = useRef(THUMB_INSET);
  const [thumbLeft, setThumbLeft] = useState(THUMB_INSET);
  const prevProgressRef = useRef(0);
  const { trigger } = useHaptics();

  const updateThumb = useCallback((left: number, progress: number) => {
    thumbLeftRef.current = left;
    progressRef.current = progress;
    setThumbLeft(left);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return;
    // Hit-test: only start drag if pointer started on the thumb
    const rect = trackRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const tLeft = thumbLeftRef.current;
    if (pointerX < tLeft - 4 || pointerX > tLeft + THUMB_SIZE + 4) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    trigger('light');
  }, [trigger]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const trackWidth = trackRef.current.getBoundingClientRect().width;
    const maxTravel = trackWidth - THUMB_SIZE - THUMB_INSET * 2;
    const delta = e.clientX - startXRef.current;
    const newProgress = Math.min(1, Math.max(0, delta / maxTravel));

    // Haptic feedback at 25%, 50%, 75% milestones
    const prevQuarter = Math.floor(prevProgressRef.current * 4);
    const currQuarter = Math.floor(newProgress * 4);
    if (currQuarter > prevQuarter && currQuarter < 4) {
      trigger('light');
    }
    prevProgressRef.current = newProgress;

    updateThumb(THUMB_INSET + newProgress * maxTravel, newProgress);
  }, [updateThumb, trigger]);

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (progressRef.current >= COMPLETE_THRESHOLD) {
      trigger('success');
      onComplete();
    } else {
      updateThumb(THUMB_INSET, 0);
    }
  }, [onComplete, updateThumb, trigger]);

  return (
    <div className="w-full flex flex-col items-center gap-3 px-5 pb-8">
      <div
        ref={trackRef}
        data-testid="slide-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-xl touch-none select-none"
      >
        {/* Shimmer sweep */}
        <div className="absolute inset-0 pointer-events-none animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* Label */}
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/40 select-none pl-12">
          Slide to continue
        </span>

        {/* Thumb — visual only, no pointer events */}
        <div
          data-testid="slide-thumb"
          style={{ '--thumb-left': `${thumbLeft}px` } as React.CSSProperties}
          className={[
            'slide-thumb absolute top-2 w-10 h-10 rounded-xl pointer-events-none',
            'bg-white shadow-md',
            'flex items-center justify-center',
            isDragging ? '' : 'slide-thumb-animating',
          ].join(' ')}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M7 5l5 5-5 5" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
