'use client';

/**
 * Export.
 *
 * The watermark is a line of copy, not a switch: it is permanent attribution
 * on a product that takes no money, so offering a toggle that cannot be
 * turned off would be worse than not offering one.
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Word } from '@Ordio/shared';
import { chip, solidButton } from '@/lib/variants';
import { useCaptureStore } from '@/stores';
import { useVideoExporter, fileExtension } from '@/hooks/video/useVideoExporter';
import { frameSize } from '@/lib/desktop/deskStyleConfig';
import type { DeskState } from '@/lib/desktop/deskState';
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

  /**
   * A real encode, replacing a setInterval that bumped a counter to 100 and
   * declared the export done. It produced no file — the button rendered a
   * progress bar and nothing else, which is worse than no button, because the
   * bar is a claim that work happened.
   */
  const exporter = useVideoExporter();
  const audioBuffer = useCaptureStore((s) => s.mixedBuffer ?? s.audioBuffer);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const runExport = useCallback(async () => {
    if (!audioBuffer) return;
    onStart();

    /* The encoder draws frames onto whatever canvas it is handed, so this is
       a surface, not a view — it never enters the document. The desk's own
       preview stays DOM, which is what lets it use real CSS text wrapping. */
    const { width, height } = frameSize(state.format);
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvasRef.current = canvas;

    /* The style is already in the store — `useDeskStyleSync` publishes every
       desk edit as it happens, which is also what the on-screen canvas reads.
       Publishing again here would be a second writer of the same value, and a
       second writer is how the two came apart in the first place. */
    await exporter.startExport(canvas, audioBuffer, true);
  }, [audioBuffer, exporter, onStart, state]);

  /* Progress and completion come from the encoder now, not a timer. */
  useEffect(() => {
    if (state.exStage !== 'running') return;
    patch({ exportPct: Math.round(exporter.exportProgress) });
  }, [exporter.exportProgress, state.exStage, patch]);

  useEffect(() => {
    if (state.exStage === 'running' && exporter.exportedUrl) {
      patch({ exStage: 'done', exportPct: 100 });
    }
  }, [exporter.exportedUrl, state.exStage, patch]);

  useEffect(() => {
    if (state.exStage === 'running' && exporter.error) {
      toast.error(exporter.error);
      patch({ exStage: 'setup', exportPct: 0 });
    }
  }, [exporter.error, state.exStage, patch]);

  const download = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

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
              onClick={runExport}
              disabled={words.length === 0 || !audioBuffer}
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
            onClick={() => {
              exporter.cancelExport();
              patch({ exStage: 'setup', exportPct: 0 });
            }}
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
          {/* It said "saved to your clips", and nothing saved it anywhere.
              The encoder hands back a blob URL, so what actually exists is a
              file to download. */}
          <p className="ord-type-footnote m-0 text-[var(--text-muted)]">
            Your {KINDS.find((k) => k.id === state.exKind)?.label.toLowerCase()} is
            ready.
          </p>
          <button
            type="button"
            onClick={download}
            disabled={!exporter.exportedUrl}
            className={cn(
              solidButton({ tone: 'acid', size: 'lg' }),
              'justify-center disabled:opacity-40'
            )}
          >
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(chip({ size: 'md' }), 'h-11 justify-center')}
          >
            Done
          </button>
        </>
      )}
    </DeskSheet>
  );
}
