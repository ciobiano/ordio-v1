'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon,
  PauseIcon,
  AiMagicIcon,
  ArrowRight01Icon,
  Undo02Icon,
  Redo02Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ordStickerBtn } from '@/lib/ordioVariants';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseExportHistoryReturn } from '@/hooks/export/useExportHistory';
import { Scrubber } from './Scrubber';

interface TransportBarProps {
  playback: UsePlaybackReturn;
  history: UseExportHistoryReturn;
  onDirector: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Play, elapsed/total, Director, and the single undo pair.
 *
 * Director moved here from the dock: it is the one action that rewrites the
 * whole look at once, so it reads as a peer of playback rather than as a
 * fifth tab. That also frees the dock to be four evenly-weighted panels.
 *
 * The undo pair sits above whichever panel is open because there is now one
 * history behind both caption edits and trim commits — see `useExportHistory`.
 */
export function TransportBar({ playback, history, onDirector }: TransportBarProps) {
  const { duration, registerTimeListener } = playback;
  const [elapsed, setElapsed] = useState(playback.currentTime);

  // Throttled to whole seconds: the label only changes once a second, so there
  // is no reason to re-render this subtree at frame rate. The scrubber, which
  // does move every frame, writes to the DOM instead.
  useEffect(
    () =>
      registerTimeListener((time) => {
        setElapsed((previous) => (Math.floor(previous) === Math.floor(time) ? previous : time));
      }),
    [registerTimeListener]
  );

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 px-4 pb-1 pt-3.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => (playback.isPlaying ? playback.pause() : void playback.play())}
          disabled={duration === 0}
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
          className={cn(
            'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full',
            'bg-white/[0.10] text-[color:var(--acid-text-1)] transition-colors',
            'hover:bg-white/[0.16] disabled:cursor-default disabled:opacity-40'
          )}
        >
          <HugeiconsIcon
            icon={playback.isPlaying ? PauseIcon : PlayIcon}
            size={18}
            strokeWidth={2}
            className="[&>path]:fill-current"
          />
        </button>

        <div className="flex shrink-0 flex-col leading-[1.15] tabular-nums">
          <span className="text-[15px] font-semibold text-[color:var(--acid-text-1)]">
            {formatTime(elapsed)}
          </span>
          <span className="text-[15px] font-semibold text-[color:var(--acid-text-3)]">
            {formatTime(duration)}
          </span>
        </div>

        <button
          type="button"
          onClick={onDirector}
          className={cn(ordStickerBtn({ tone: 'premiumSoft', size: 'sm' }), 'mx-1 min-w-0 flex-1 text-base')}
        >
          <HugeiconsIcon icon={AiMagicIcon} size={18} strokeWidth={2} />
          Direct it
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2.4} />
        </button>

        <button
          type="button"
          onClick={history.undo}
          disabled={!history.canUndo}
          aria-label={history.undoLabel}
          className={cn(
            'flex h-11 w-[38px] shrink-0 cursor-pointer items-center justify-center',
            'text-[color:var(--acid-text-2)] transition-opacity',
            'hover:text-[color:var(--acid-text-1)] disabled:cursor-default disabled:opacity-30'
          )}
        >
          <HugeiconsIcon icon={Undo02Icon} size={20} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={history.redo}
          disabled={!history.canRedo}
          aria-label={history.redoLabel}
          className={cn(
            'flex h-11 w-[38px] shrink-0 cursor-pointer items-center justify-center',
            'text-[color:var(--acid-text-2)] transition-opacity',
            'hover:text-[color:var(--acid-text-1)] disabled:cursor-default disabled:opacity-30'
          )}
        >
          <HugeiconsIcon icon={Redo02Icon} size={20} strokeWidth={2} />
        </button>
      </div>

      <Scrubber playback={playback} />
    </div>
  );
}
