'use client';

import { useRef } from 'react';

interface TimelineStripProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function TimelineStrip({ currentTime, duration, onSeek }: TimelineStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const progress = duration > 0 ? currentTime / duration : 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="h-25 flex-none bg-acid-bg-subtle border-t border-acid-border-subtle px-4.5 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-acid-text-3 font-bold">
        <span className="flex gap-3.5">
          <span className="text-acid-text-1">Timeline</span>
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration)}</span>
        </span>
      </div>
      <div
        ref={stripRef}
        data-testid="timeline-strip"
        onPointerDown={handlePointerDown}
        className="flex-1 relative flex items-center cursor-pointer"
      >
        <div className="w-full h-13 bg-acid-surface-1 rounded-acid-sm" aria-hidden="true" />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-acid-text-1 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
