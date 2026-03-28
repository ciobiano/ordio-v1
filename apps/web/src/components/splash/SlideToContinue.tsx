'use client';

import { useRef, useState, useCallback } from 'react';

const THUMB_SIZE = 36; // matches w-9 (Tailwind = 9 * 4px = 36px)
const COMPLETE_THRESHOLD = 0.85;

interface Props {
  onComplete: () => void;
  userName?: string;
}

export function SlideToContinue({ onComplete, userName }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0–1
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const progressRef = useRef(0);
  const [thumbLeft, setThumbLeft] = useState(7); // 7px = left inset

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const trackWidth = trackRef.current.getBoundingClientRect().width;
    const maxTravel = trackWidth - THUMB_SIZE - 14; // 7px inset each side
    const delta = e.clientX - startXRef.current;
    const newProgress = Math.min(1, Math.max(0, delta / maxTravel));
    progressRef.current = newProgress;
    setProgress(newProgress);
    setThumbLeft(7 + newProgress * maxTravel);
  }, []);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (progressRef.current >= COMPLETE_THRESHOLD) {
      onComplete();
    } else {
      setProgress(0);
      progressRef.current = 0;
      setThumbLeft(7);
    }
  }, [onComplete]);

  return (
    <div className="w-full flex flex-col items-center gap-3 px-5 pb-8">
      {userName && (
        <p className="text-xs text-white/20 tracking-wide">
          Welcome back, {userName}
        </p>
      )}

      <div
        ref={trackRef}
        data-testid="slide-track"
        className="relative w-full h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        {/* Shimmer sweep */}
        <div className="absolute inset-0 pointer-events-none animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* Label */}
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/40 select-none pl-12">
          Slide to continue
        </span>

        {/* Thumb */}
        <div
          data-testid="slide-thumb"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => handlePointerUp()}
          style={{
            left: `${thumbLeft}px`,
            transition: isDragging ? 'none' : 'left 0.3s ease',
          }}
          className="absolute top-2.5 w-9 h-9 rounded-xl bg-white shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M7 5l5 5-5 5" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
