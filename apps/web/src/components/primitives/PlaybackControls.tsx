'use client';

import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';

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
  const { currentTime, duration, seek } = playback;

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <span
        className="text-muted-foreground text-xs tabular-nums shrink-0"
        aria-live="off"
      >
        {formatTime(currentTime)}
      </span>

      <Slider
        className="flex-1"
        min={0}
        max={duration || 1}
        step={0.01}
        value={[currentTime]}
        onValueChange={(val) => seek(Array.isArray(val) ? val[0] : val)}
        disabled={duration === 0}
        aria-label="Seek audio"
      />

      <span
        className="text-muted-foreground text-xs tabular-nums shrink-0"
        aria-live="off"
      >
        {formatTime(duration)}
      </span>
    </div>
  );
}
