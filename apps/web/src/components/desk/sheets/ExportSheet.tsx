'use client';

/**
 * Export.
 *
 * The watermark is a line of copy, not a switch: it is permanent attribution
 * on a product that takes no money, so offering a toggle that cannot be
 * turned off would be worse than not offering one.
 */

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Word } from '@Ordio/shared';
import { chip, solidButton } from '@/lib/desk/deskVariants';
import type { DeskState } from '@/lib/desk/deskState';
import { DeskSheet } from './DeskSheet';

const KINDS = [
  { id: 'mp4', label: 'Video', hint: 'MP4 with captions burned in' },
  { id: 'srt', label: 'SRT', hint: 'Subtitles for any platform' },
  { id: 'vtt', label: 'VTT', hint: 'Web captions' },
  { id: 'txt', label: 'Transcript', hint: 'Plain text of every word' },
] as const;

const RESOLUTIONS = [
  { id: '720', label: '720p' },
  { id: '1080', label: '1080p' },
  { id: '2160', label: '4K' },
] as const;

interface ExportSheetProps {
  state: DeskState;
  words: Word[];
  patch: (patch: Partial<DeskState>) => void;
  onClose: () => void;
  onStart: () => void;
}

/** Timestamp for the subtitle preview — SRT uses a comma, VTT a full stop. */
function stamp(seconds: number, comma: boolean): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s}${comma ? ',' : '.'}${ms}`;
}

export function ExportSheet({
  state,
  words,
  patch,
  onClose,
  onStart,
}: ExportSheetProps) {
  const isVideo = state.exKind === 'mp4';

  /* Drive the progress bar while a render is running. */
  useEffect(() => {
    if (state.exStage !== 'running') return;
    const timer = window.setInterval(() => {
      const next = Math.min(100, state.exportPct + 4);
      patch(next >= 100 ? { exportPct: 100, exStage: 'done' } : { exportPct: next });
    }, 120);
    return () => window.clearInterval(timer);
  }, [state.exStage, state.exportPct, patch]);

  const preview = (() => {
    if (isVideo || words.length === 0) return '';
    if (state.exKind === 'txt') return words.map((w) => w.text).join(' ');
    const comma = state.exKind === 'srt';
    return words
      .slice(0, 3)
      .map((w, i) =>
        [
          state.exKind === 'srt' ? String(i + 1) : '',
          `${stamp(w.start, comma)} --> ${stamp(w.end, comma)}`,
          w.text,
          '',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .join('\n');
  })();

  return (
    <DeskSheet title="Export" onClose={onClose}>
      {state.exStage === 'setup' && (
        <>
          <span className="ord-type-title font-bold text-[var(--ord-paper)]">
            Export
          </span>

          <div className="flex flex-col gap-2 overflow-y-auto">
            <span className="ord-eyebrow">What you get</span>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => patch({ exKind: kind.id })}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors duration-[var(--dur-tap)]',
                    state.exKind === kind.id
                      ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                      : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                  )}
                >
                  <span className="ord-type-footnote font-semibold text-[var(--ord-paper)]">
                    {kind.label}
                  </span>
                  <span className="ord-type-micro text-[var(--text-muted)]">
                    {kind.hint}
                  </span>
                </button>
              ))}
            </div>

            {isVideo ? (
              <>
                <span className="ord-eyebrow pt-1">Resolution</span>
                <div className="flex gap-2">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => patch({ exResolution: res.id })}
                      className={chip({
                        selected: state.exResolution === res.id,
                        size: 'md',
                      })}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
                <p className="ord-type-micro m-0 pt-1 text-[var(--text-muted)]">
                  Every export carries a small ordio mark in the corner.
                </p>
              </>
            ) : (
              <>
                <span className="ord-eyebrow pt-1">Preview</span>
                <pre className="ord-type-micro m-0 max-h-40 overflow-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--ord-ink)] p-3 font-[family-name:var(--font-mono)] whitespace-pre-wrap text-[var(--text-body)]">
                  {preview || 'Nothing to export yet.'}
                </pre>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(chip({ size: 'md' }), 'h-11 flex-1 justify-center')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={words.length === 0}
              className={cn(
                solidButton({ tone: 'acid', size: 'lg' }),
                'flex-[1.3] disabled:opacity-40'
              )}
            >
              Export
            </button>
          </div>
        </>
      )}

      {state.exStage === 'running' && (
        <>
          <span className="ord-type-title font-bold text-[var(--ord-paper)]">
            Rendering
          </span>
          <div
            role="progressbar"
            aria-valuenow={state.exportPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ord-paper)]/14"
          >
            {/* Progress is position over time, not a choice — paper. */}
            <div
              className="h-full rounded-full bg-[var(--ord-paper)] transition-[width] duration-[var(--dur-snap)]"
              style={{ width: `${state.exportPct}%` }}
            />
          </div>
          <span className="ord-mono">{state.exportPct}%</span>
          <button
            type="button"
            onClick={() => patch({ exStage: 'setup', exportPct: 0 })}
            className={cn(chip({ size: 'md' }), 'h-11 justify-center')}
          >
            Cancel
          </button>
        </>
      )}

      {state.exStage === 'done' && (
        <>
          <span className="ord-type-title font-bold text-[var(--ord-paper)]">
            Ready
          </span>
          <p className="ord-type-footnote m-0 text-[var(--text-muted)]">
            Your {KINDS.find((k) => k.id === state.exKind)?.label.toLowerCase()} is
            saved to your clips.
          </p>
          <button
            type="button"
            onClick={onClose}
            className={cn(solidButton({ tone: 'acid', size: 'lg' }), 'justify-center')}
          >
            Done
          </button>
        </>
      )}
    </DeskSheet>
  );
}
