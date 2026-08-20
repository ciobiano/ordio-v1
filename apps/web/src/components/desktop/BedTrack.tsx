'use client';

/**
 * The Music track: a drop target, and the sound sitting on it.
 *
 * Drag a sound anywhere onto this row and it lands where you let go. The block
 * can then be slid along the timeline, or trimmed from either end down to the
 * exact part you wanted — which is why it draws its own waveform. The stage
 * never plays the bed back, so without an outline the handles would be dragged
 * against a blank rectangle.
 *
 * Every drag goes through the pure functions in lib/audio/bedGeometry, which
 * own the clamping. A handle dragged past its opposite edge, or past the point
 * the source runs out, is the kind of bug that leaves the block drawn at a
 * width the audio does not match — silent, and only heard on export.
 */

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  bedDuration,
  moveBed,
  timeAtX,
  trimBedEnd,
  trimBedStart,
  type BedClip,
} from '@/lib/audio/bedGeometry';
import { visiblePeaks, type BedSource } from '@/lib/audio/bedPeaks';

type Grab = 'move' | 'start' | 'end';

interface BedTrackProps {
  bed: BedClip | null;
  source: BedSource | null;
  duration: number;
  /** True while the dropped file is still being decoded. */
  loading: boolean;
  onDropFile: (file: File, atSecond: number) => void;
  onChange: (next: BedClip) => void;
  /** Called once at the end of a drag, so undo gets one entry, not sixty. */
  onCommit: () => void;
  onRemove: () => void;
}

export function BedTrack({
  bed,
  source,
  duration,
  loading,
  onDropFile,
  onChange,
  onCommit,
  onRemove,
}: BedTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const grab = useRef<{ kind: Grab; offset: number } | null>(null);

  const pct = (value: number) =>
    duration > 0 ? `${Math.min(100, Math.max(0, (value / duration) * 100))}%` : '0%';

  /* ── Dropping ─────────────────────────────────────────────────────── */

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = Array.from(event.dataTransfer.files).find((f) =>
        f.type.startsWith('audio/')
      );
      const rect = trackRef.current?.getBoundingClientRect();
      if (!file || !rect) return;
      onDropFile(file, timeAtX(event.clientX, rect, duration));
    },
    [duration, onDropFile]
  );

  /* ── Dragging what is already there ───────────────────────────────── */

  const beginGrab = useCallback(
    (kind: Grab) => (event: React.PointerEvent) => {
      if (!bed) return;
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      const rect = trackRef.current?.getBoundingClientRect();
      /* For a move, remember where inside the block the pointer went down, so
         the block does not jump its own left edge under the cursor. */
      const at = rect ? timeAtX(event.clientX, rect, duration) : 0;
      grab.current = { kind, offset: kind === 'move' ? at - bed.startAt : 0 };
    },
    [bed, duration]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const held = grab.current;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!held || !bed || !rect) return;
      const at = timeAtX(event.clientX, rect, duration);
      if (held.kind === 'move') onChange(moveBed(bed, at - held.offset));
      else if (held.kind === 'start') onChange(trimBedStart(bed, at));
      else onChange(trimBedEnd(bed, at));
    },
    [bed, duration, onChange]
  );

  const endGrab = useCallback(() => {
    if (!grab.current) return;
    grab.current = null;
    onCommit();
  }, [onCommit]);

  /* ── Render ───────────────────────────────────────────────────────── */

  const peaks = bed && source ? visiblePeaks(source, bed.trimIn, bed.trimOut) : [];

  return (
    <div
      ref={trackRef}
      className={cn('ord-bedtrack', over && 'is-over')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onPointerMove={onPointerMove}
      onPointerUp={endGrab}
      onPointerCancel={endGrab}
    >
      {!bed && (
        <span className="ord-bedtrack-hint">
          {loading ? 'Reading the sound…' : 'Drop a sound here'}
        </span>
      )}

      {bed && (
        <div
          className="ord-bedclip"
          style={{ left: pct(bed.startAt), width: pct(bedDuration(bed)) }}
          onPointerDown={beginGrab('move')}
          role="group"
          aria-label={`${bed.name}, ${bedDuration(bed).toFixed(1)} seconds at ${bed.startAt.toFixed(1)} seconds`}
        >
          {/* The outline, so the handles have something to aim at. */}
          <span className="ord-bedclip-wave" aria-hidden="true">
            {peaks.map((p, i) => (
              <i key={i} style={{ height: `${Math.max(6, p * 100)}%` }} />
            ))}
          </span>

          <span className="ord-bedclip-name">{bed.name}</span>

          <button
            type="button"
            className="ord-bedclip-handle is-start"
            aria-label="Trim the start of the sound"
            onPointerDown={beginGrab('start')}
          />
          <button
            type="button"
            className="ord-bedclip-handle is-end"
            aria-label="Trim the end of the sound"
            onPointerDown={beginGrab('end')}
          />
          <button
            type="button"
            className="ord-bedclip-remove"
            aria-label={`Remove ${bed.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
