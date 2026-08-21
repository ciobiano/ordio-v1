'use client';

/**
 * The canvas.
 *
 * This used to be a hand-written DOM preview that re-implemented caption
 * layout in CSS. It was a second renderer, and it disagreed with the one that
 * ships: it painted every segment of the transcript stacked on the frame
 * rather than the line being spoken, and it drew no animation at all, because
 * the desk's animation choice never reached a renderer in the first place.
 *
 * It now mounts the same `CanvasPreview` the phone does, reading the same
 * `useUIStore.style` the export encoder reads — see `useDeskStyleSync`. There
 * is one renderer, so preview and export cannot disagree; a caption bug is now
 * one bug in one place rather than two that have to be found separately.
 *
 * What stays here is the chrome that is genuinely desk-only: the safe-zone
 * overlay, and the way back from a hidden-caption view.
 */

import type { DeskState } from '@/lib/desktop/deskState';
import { SAFE } from '@/lib/desktop/deskCatalog';
import CanvasPreview from '@/components/media/video/CanvasPreview';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { FeatureKey } from '@/lib/featureGates';

interface PlayerStageProps {
  state: DeskState;
  playback: UsePlaybackReturn;
  onShowCaptions: () => void;
  onLocked?: (feature: FeatureKey) => void;
}

export function PlayerStage({
  state,
  playback,
  onShowCaptions,
  onLocked,
}: PlayerStageProps) {
  const safe = SAFE[state.safe];

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
      <div className="relative flex h-full max-h-[640px] items-center justify-center">
        <CanvasPreview
          playback={playback}
          format={state.format}
          waveformStyle={state.visual}
          hideCaptions={state.capHidden}
          onLocked={onLocked}
          className="h-full"
        />

        {/* Safe zones sit over the canvas rather than in it: they are a guide
            for composing, never part of the exported frame. */}
        {state.safeShow && state.safe !== 'none' && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div
              className="absolute right-[4%] left-[4%] rounded-xl border border-dashed border-[rgba(255,255,234,0.5)]"
              style={{ top: safe.top, bottom: safe.bottom }}
            />
            <div
              className="absolute inset-x-0 top-0 bg-[rgba(255,0,102,0.14)]"
              style={{ height: safe.top }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-[rgba(255,0,102,0.14)]"
              style={{ height: safe.bottom }}
            />
            <span className="ord-mono absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-xl bg-[rgba(6,6,6,0.7)] px-2 py-1 ord-type-micro text-[var(--ord-paper)]">
              {safe.label}
            </span>
          </div>
        )}

        {state.capHidden && (
          <button
            type="button"
            onClick={onShowCaptions}
            className="absolute right-2 bottom-2 z-30 cursor-pointer rounded-xl border-0 bg-[var(--ord-acid)] px-3 py-2 ord-type-footnote font-bold text-[var(--ord-ink)]"
          >
            Show captions
          </button>
        )}
      </div>
    </div>
  );
}
