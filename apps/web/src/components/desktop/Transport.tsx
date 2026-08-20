'use client';

/** Play/pause, clock, scrub bar, and the two canvas overlay toggles. */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/variants';
import { PauseGlyph, PlayGlyph } from './DeskIcons';

interface TransportProps {
  playing: boolean;
  t: number;
  duration: number;
  safeShow: boolean;
  capHidden: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onToggleSafe: () => void;
  onToggleCaptions: () => void;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Transport({
  playing,
  t,
  duration,
  safeShow,
  capHidden,
  onTogglePlay,
  onSeek,
  onToggleSafe,
  onToggleCaptions,
}: TransportProps) {
  const pct = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;

  return (
    <div className="flex h-[50px] flex-none items-center gap-3 px-4 pb-2">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={duration === 0}
        title="Play · space"
        className="flex size-[38px] flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--ord-paper)] text-[var(--ord-ink)] transition-transform duration-[var(--dur-tap)] active:scale-[0.96] disabled:opacity-40"
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      <span className="flex-none font-[family-name:var(--font-mono)] ord-type-caption text-[var(--ord-paper)]">
        {clock(t)} <span className="text-[var(--text-muted)]">/ {clock(duration)}</span>
      </span>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={t}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * duration);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSeek(t - 1);
          if (e.key === 'ArrowRight') onSeek(t + 1);
        }}
        className="flex h-6 min-w-0 flex-1 cursor-pointer items-center"
      >
        <div className="relative h-1 w-full rounded-full bg-[var(--ord-paper)]/14">
          {/* Paper, not acid: elapsed time is position, and position is one
              of the things the accent is explicitly not for. This is also
              the widest always-visible bar on screen, so it was the loudest
              lime object carrying no decision. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--ord-paper)]"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute -top-[5px] -ml-[7px] size-3.5 rounded-full bg-[var(--ord-paper)]"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-none gap-2">
        <button
          type="button"
          onClick={onToggleSafe}
          title="Social safe zones"
          className={cn(chip({ selected: safeShow, size: 'sm' }), 'h-[30px]')}
        >
          Safe zones
        </button>
        <button
          type="button"
          onClick={onToggleCaptions}
          className={cn(chip({ selected: !capHidden, size: 'sm' }), 'h-[30px]')}
        >
          Captions
        </button>
      </div>
    </div>
  );
}
