'use client';

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ordGhostBtn, ordStickerBtn } from '@/lib/ordioVariants';
import { Separator } from '@/components/ui/separator';
import { waveformSampler } from '@Ordio/shared/waveform';
import { detectSilentRegions } from '@Ordio/engine/media';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';

interface TrimPanelProps {
  audioBuffer: AudioBuffer | null;
  trimmer: UseAudioTrimmerReturn;
  onCommit: () => void;
  onPreviewAt?: (time: number) => void;
  /**
   * Trim-local undo pair. The export screen omits these — its undo lives in the
   * transport bar, backed by one history across captions and trim. Studio still
   * passes them because it keeps its own edit history in `useStudioEdits`.
   */
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

function formatTimestamp(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrimPanel({
  audioBuffer,
  trimmer,
  onCommit,
  onPreviewAt,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: TrimPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHandle = useRef<'start' | 'end' | null>(null);
  const lastDragTimeRef = useRef(0);

  const {
    trimState,
    setStartTime,
    setEndTime,
    toggleSilenceRange,
    deletedSilenceRanges,
    resetAll,
  } = trimmer;
  const duration = audioBuffer?.duration ?? 0;

  const bars = useMemo(() => {
    if (!audioBuffer) return [];
    return waveformSampler(audioBuffer, 100);
  }, [audioBuffer]);

  // Detect silent regions asynchronously — runs after render to avoid blocking
  const [silentRegions, setSilentRegions] = useState<ReturnType<typeof detectSilentRegions>>([]);
  useEffect(() => {
    if (!audioBuffer) {
      setSilentRegions([]);
      return;
    }
    setSilentRegions(detectSilentRegions(audioBuffer));
  }, [audioBuffer]);

  // Draw waveform with trim overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bars.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / bars.length;
    bars.forEach((amp, i) => {
      const barH = Math.max(1, amp * height * 0.8);
      const x = i * barWidth;
      const y = (height - barH) / 2;
      ctx.fillStyle = 'rgba(250, 248, 245, 0.4)';
      ctx.fillRect(x, y, barWidth - 1, barH);
    });

    if (duration > 0) {
      const startX = (trimState.startTime / duration) * width;
      const endX = (trimState.endTime / duration) * width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, startX, height);
      ctx.fillRect(endX, 0, width - endX, height);
    }
  }, [bars, trimState.startTime, trimState.endTime, duration]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current || duration === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;

      const startPct = trimState.startTime / duration;
      const endPct = trimState.endTime / duration;

      activeHandle.current = Math.abs(pct - startPct) < Math.abs(pct - endPct) ? 'start' : 'end';
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [trimState.startTime, trimState.endTime, duration]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle.current || !containerRef.current || duration === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * duration;

      if (activeHandle.current === 'start') {
        const clamped = Math.min(time, trimState.endTime - 0.1);
        setStartTime(clamped);
        lastDragTimeRef.current = clamped;
      } else {
        const clamped = Math.max(time, trimState.startTime + 0.1);
        setEndTime(clamped);
        lastDragTimeRef.current = clamped;
      }
    },
    [duration, trimState.startTime, trimState.endTime, setStartTime, setEndTime]
  );

  const handlePointerUp = useCallback(() => {
    if (activeHandle.current && onPreviewAt) {
      onPreviewAt(lastDragTimeRef.current);
    }
    activeHandle.current = null;
  }, [onPreviewAt]);

  const selectedSilenceCount = deletedSilenceRanges.size;
  const hasHandleChanges = trimState.startTime > 0 || trimState.endTime < duration;
  const hasPendingCuts = selectedSilenceCount > 0 || hasHandleChanges;

  return (
    <div className="space-y-4">
      {/* Timeline trim */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-muted-foreground">Timeline</span>
          <span className="text-xs text-muted-foreground">Drag handles to trim</span>
        </div>

        <div
          ref={containerRef}
          className="relative h-12 bg-muted rounded-lg cursor-ew-resize touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <canvas ref={canvasRef} width={600} height={48} className="w-full h-full rounded-lg" />

          <div
            className="absolute top-0 bottom-0 w-1.5 bg-primary rounded-sm cursor-ew-resize"
            style={{ left: `${duration > 0 ? (trimState.startTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>

          <div
            className="absolute top-0 bottom-0 w-1.5 bg-primary rounded-sm cursor-ew-resize -translate-x-full"
            style={{ left: `${duration > 0 ? (trimState.endTime / duration) * 100 : 100}%` }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground font-mono">
            {formatTimestamp(trimState.startTime)}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {formatTimestamp(trimState.endTime)}
          </span>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Detected silence chips */}
      {silentRegions.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-muted-foreground">Detected pauses</span>
            <span className="text-xs text-muted-foreground">Tap to select</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {silentRegions.map((region) => {
              const isDeleted = deletedSilenceRanges.has(region.id);
              return (
                <Button
                  key={region.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggleSilenceRange(region.id, { start: region.start, end: region.end })
                  }
                  className={cn(
                    'h-auto px-2.5 py-1.5 rounded-md text-xs font-mono',
                    isDeleted
                      ? 'bg-destructive/12 border border-destructive/30 text-destructive line-through opacity-50 hover:bg-destructive/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {formatTimestamp(region.start)} · {region.duration.toFixed(1)}s
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 pt-1">
        {onUndo && onRedo && (
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              ↩
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              ↪
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => resetAll(duration)}
          disabled={!hasPendingCuts}
          className={cn(ordGhostBtn({ size: 'md' }), 'px-4')}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={!hasPendingCuts}
          className={cn(
            ordStickerBtn({ tone: 'accent', size: 'sm' }),
            'flex-1 text-[15px]',
            hasPendingCuts
              ? 'bg-[color:var(--acid-error)] text-[color:var(--acid-text-1)]'
              : 'bg-white/[0.10] text-[color:var(--acid-text-3)] shadow-none'
          )}
        >
          Apply cuts
        </button>
      </div>
    </div>
  );
}
