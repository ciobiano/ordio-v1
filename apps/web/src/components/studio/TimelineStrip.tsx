'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCaptureStore } from '@/stores';
import { waveformSampler } from '@Ordio/shared/waveform';
import type { CutRange } from '@/hooks/studio/useStudioEdits';

const BAR_COUNT = 150;
/** Normalized amplitude below this renders as a dimmed "silence" bar. */
const SILENCE_THRESHOLD = 0.08;

interface TimelineStripProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  /**
   * Hot-path time updates (60fps, no React re-render) — the playhead tracks
   * playback through this; `currentTime` alone is throttled to ~4fps.
   */
  registerTimeListener?: (fn: (t: number, d: number) => void) => () => void;
  /** Pending transcript cuts — their bars render red, per the design. */
  cutRanges?: CutRange[];
}

function formatTime(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function TimelineStrip({
  currentTime,
  duration,
  onSeek,
  registerTimeListener,
  cutRanges = [],
}: TimelineStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const timeLabelRef = useRef<HTMLSpanElement | null>(null);
  const draggingRef = useRef(false);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);

  // While dragging, the playhead follows the pointer locally; the actual
  // seek fires once on release so playback isn't restarted per pointermove.
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  useEffect(() => {
    draggingRef.current = dragRatio !== null;
  }, [dragRatio]);

  const bars = useMemo(
    () => (audioBuffer ? waveformSampler(audioBuffer, BAR_COUNT) : []),
    [audioBuffer]
  );

  const playRatio = duration > 0 ? currentTime / duration : 0;
  const progress = dragRatio ?? playRatio;
  const hasAudio = bars.length > 0 && duration > 0;

  // Smooth playhead: direct DOM updates from the playback time loop.
  useEffect(() => {
    if (!registerTimeListener) return;
    return registerTimeListener((t, d) => {
      if (draggingRef.current || d <= 0) return;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${(t / d) * 100}%`;
      }
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = formatTime(t);
      }
    });
  }, [registerTimeListener]);

  const barIsCut = useMemo(() => {
    if (!hasAudio || cutRanges.length === 0) return null;
    const flags = new Array<boolean>(BAR_COUNT).fill(false);
    for (const range of cutRanges) {
      const from = Math.max(0, Math.floor((range.start / duration) * BAR_COUNT));
      const to = Math.min(BAR_COUNT, Math.ceil((range.end / duration) * BAR_COUNT));
      for (let i = from; i < to; i++) flags[i] = true;
    }
    return flags;
  }, [hasAudio, cutRanges, duration]);

  const ratioFromPointer = (e: React.PointerEvent<HTMLDivElement>): number => {
    const el = stripRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasAudio) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragRatio(ratioFromPointer(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    setDragRatio(ratioFromPointer(e));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    const ratio = ratioFromPointer(e);
    setDragRatio(null);
    onSeek(ratio * duration);
  };

  const ruler =
    duration > 0
      ? [0, duration / 3, (2 * duration) / 3, duration]
      : [0];

  return (
    <div className="h-25 flex-none bg-acid-bg-subtle border-t border-acid-border-subtle px-4.5 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-acid-text-3 font-bold">
        <span className="flex gap-3.5">
          <span className="text-acid-text-1">Timeline</span>
          {ruler.map((t, i) => (
            <span key={i}>{formatTime(t)}</span>
          ))}
        </span>
        {hasAudio && (
          <span ref={timeLabelRef} className="tabular-nums">
            {formatTime(dragRatio !== null ? dragRatio * duration : currentTime)}
          </span>
        )}
      </div>
      <div
        ref={stripRef}
        data-testid="timeline-strip"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragRatio(null)}
        className="flex-1 relative flex items-center cursor-pointer touch-none select-none"
      >
        {hasAudio ? (
          <div className="w-full h-13 flex items-center gap-px" aria-hidden="true">
            {bars.map((amp, i) => (
              <div
                key={i}
                className={
                  'flex-1 min-w-0 rounded-[1px] ' +
                  (barIsCut?.[i]
                    ? 'bg-acid-error/55'
                    : amp < SILENCE_THRESHOLD
                      ? 'bg-acid-surface-3'
                      : 'bg-acid-accent/50')
                }
                style={{ height: `${Math.max(6, Math.min(100, amp * 100))}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="w-full h-13 bg-acid-surface-1 rounded-acid-sm flex items-center justify-center text-[11px] text-acid-text-4">
            Record or open a clip to see its waveform
          </div>
        )}
        {hasAudio && (
          <div
            ref={playheadRef}
            className="absolute -top-1 -bottom-1 w-0.5 bg-acid-text-1 pointer-events-none"
            style={{ left: `${progress * 100}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-[3px] bg-acid-text-1" />
          </div>
        )}
      </div>
    </div>
  );
}
