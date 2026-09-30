'use client';

/**
 * The timeline: ruler, caption blocks, music bed.
 *
 * There is deliberately no audio waveform row. The stage plays the clip back
 * and already draws its amplitude, so a second read-out of the same signal
 * cost 52px and told you nothing new. What is left is the two things you can
 * actually edit here — what is said, and what plays under it — each carrying
 * its own hue so the stack reads at a glance.
 *
 * Horizontal zoom widens the track surface; the gutter labels stay put.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { trackBlock } from '@/lib/variants';
import type { DeskLine } from '@/lib/desktop/deskState';
import type { BedClip } from '@/lib/audio/bedGeometry';
import type { BedSource } from '@/lib/audio/bedPeaks';
import { BedTrack } from './BedTrack';
import { MinusGlyph, PlusGlyph } from './DeskIcons';

interface TimelineDeckProps {
  lines: DeskLine[];
  duration: number;
  t: number;
  zoom: number;
  selRow: number;
  trimIn: number;
  trimOut: number;
  onSeek: (t: number) => void;
  onSelectRow: (row: number) => void;
  onZoom: (delta: number) => void;
  /* Music */
  bed: BedClip | null;
  bedSource: BedSource | null;
  bedLoading: boolean;
  onDropBed: (file: File, atSecond: number) => void;
  onChangeBed: (next: BedClip) => void;
  onCommitBed: () => void;
  onRemoveBed: () => void;
}

const TRACKS = [
  { label: 'Captions', className: 'ord-track-captions' },
  { label: 'Music', className: 'ord-track-music' },
];

type BlockState = 'idle' | 'active' | 'selected';

/**
 * Which of the three visual states a caption block is in.
 *
 * Both conditions can be true at once, so this is a precedence decision.
 * Selection wins, because it is the only one of the two with no other carrier:
 * every inspector panel edits `selRow`, and if the lime dropped off while the
 * playhead swept past, the block you are editing would vanish mid-playback.
 * Playback position never goes missing — the playhead line draws it across
 * every track regardless of what any block is doing.
 *
 * Derived, not stored: both inputs come from `selRow` and the playback clock,
 * so this recomputes each render rather than keeping a copy that can drift.
 */
function blockState(isSelected: boolean, isUnderPlayhead: boolean): BlockState {
  if (isSelected) return 'selected';
  if (isUnderPlayhead) return 'active';
  return 'idle';
}

const zoomBtn =
  'flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--ord-paper)]/7 ' +
  'text-[var(--text-body)] transition-colors duration-[var(--dur-tap)] hover:text-[var(--ord-paper)]';

export function TimelineDeck(props: TimelineDeckProps) {
  const { duration, t, zoom, lines, selRow, trimIn, trimOut } = props;
  const pct = (value: number) =>
    duration > 0 ? `${Math.min(100, Math.max(0, (value / duration) * 100))}%` : '0%';

  const ticks = useMemo(() => {
    if (duration <= 0) return [];
    const step = duration / 6;
    return Array.from({ length: 7 }, (_, i) => {
      const at = i * step;
      return {
        left: pct(at),
        label: `${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')}`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    props.onSeek(((e.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <section className="ord-timeline" aria-label="Timeline">
      <div className="ord-timeline-head">
        <span className="ord-eyebrow">Timeline</span>
        <span className="ord-mono text-[var(--ord-paper)]/34">
          space play · ← → nudge · ⌥← ⌥→ word · S split
        </span>
        <div className="flex-1" />
        <span className="ord-mono">
          {trimIn > 0 || trimOut > 0
            ? `trimmed ${(trimIn + trimOut).toFixed(1)}s`
            : 'full length'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => props.onZoom(-0.5)}
            aria-label="Zoom out"
            className={zoomBtn}
          >
            <MinusGlyph size={12} />
          </button>
          <span className="ord-mono w-8 text-center">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            onClick={() => props.onZoom(0.5)}
            aria-label="Zoom in"
            className={zoomBtn}
          >
            <PlusGlyph size={12} />
          </button>
        </div>
      </div>

      {/* The vertical scroller is this row, not the track column — the gutter
          labels have to travel with their rows, or the names desync from the
          tracks they name. Horizontal stays on the track column so the gutter
          never slides out of view. Frozen-column layout, same as a spreadsheet. */}
      <div className="ord-timeline-body">
        <div className="ord-track-gutter">
          <div className="ord-track-ruler flex-none" />
          {TRACKS.map((track) => (
            <div
              key={track.label}
              className={cn(
                track.className,
                'flex flex-none items-center gap-2 px-4.5 text-[var(--text-muted)]'
              )}
            >
              <span className="truncate ord-type-caps">
                {track.label}
              </span>
            </div>
          ))}
        </div>

        <div data-scroll className="ord-track-scroll">
          <div
            className="relative h-full min-w-full"
            style={{ width: `${zoom * 100}%` }}
          >
            <div
              onClick={seekFromEvent}
              className="ord-track-ruler cursor-pointer"
            >
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute inset-y-0 flex items-center border-l border-[var(--ord-paper)]/10 pl-1"
                  style={{ left: tick.left }}
                >
                  <span className="ord-mono ord-type-micro">{tick.label}</span>
                </span>
              ))}
            </div>

            <div className="ord-track-captions relative">
              {lines.map((line, row) => (
                <button
                  key={`${line.start}-${row}`}
                  type="button"
                  onClick={() => props.onSelectRow(row)}
                  className={cn(
                    trackBlock({
                      tone: 'speech',
                      state: blockState(row === selRow, t >= line.start && t < line.end),
                    }),
                    'top-1.5 bottom-1.5 px-2.5 font-[family-name:var(--font-display)] ord-type-footnote'
                  )}
                  style={{
                    left: pct(line.start),
                    width: pct(line.end - line.start),
                  }}
                >
                  <span className="truncate">
                    {line.words.map((w) => w.text).join(' ')}
                  </span>
                </button>
              ))}
            </div>

            {/* Was a static strip printing the name of a bed that did not
                exist. Now the track itself: drop a sound on it, slide it, trim
                it from either end. */}
            <div className="ord-track-music relative px-0 py-2">
              <BedTrack
                bed={props.bed}
                source={props.bedSource}
                duration={duration}
                loading={props.bedLoading}
                onDropFile={props.onDropBed}
                onChange={props.onChangeBed}
                onCommit={props.onCommitBed}
                onRemove={props.onRemoveBed}
              />
            </div>

            {/* Trim shading spans every track, because a trim removes time from
                the whole clip — it was only ever drawn on the audio row because
                that is where the waveform happened to live. */}
            {trimIn > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 border-r-2 border-[var(--ord-rose)] bg-[var(--ord-ink)]/72"
                style={{ width: pct(trimIn) }}
              />
            )}
            {trimOut > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 border-l-2 border-[var(--ord-rose)] bg-[var(--ord-ink)]/72"
                style={{ width: pct(trimOut) }}
              />
            )}

            {/* Lime, and the only lime on the timeline: where you are is the
                thing you look for first, so it gets the colour that is found
                first. Selection is paper, so the two never compete. */}
            <div
              className="pointer-events-none absolute inset-y-1 w-0.5 rounded-full bg-[var(--ord-acid)]"
              style={{ left: pct(t) }}
            >
              <span className="absolute top-0 -left-[5px] size-3 rounded-full bg-[var(--ord-acid)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
