'use client';

/**
 * Export.
 *
 * Setup is the compact sheet: what you get, then one commit. Once a video
 * starts encoding the card widens into two columns — the frame being encoded
 * on the left, drawn from the very canvas the encoder writes to, and the
 * progress on the right — and when the file exists the left column plays it.
 *
 * Text formats never touch the encoder. SRT, VTT and the transcript are built
 * from the caption lines and downloaded straight away; they used to be
 * previewed here and then quietly replaced by a video download.
 *
 * The watermark is a line of copy, not a switch: it is permanent attribution
 * on a product that takes no money, so offering a toggle that cannot be
 * turned off would be worse than not offering one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { notifyError } from '@/lib/errors/notify';
import { cn } from '@/lib/utils';
import type { Word } from '@Ordio/shared';
import { sheetButton, sheetOption } from '@/lib/variants';
import { useCaptureStore } from '@/stores';
import { useVideoExporter, fileExtension } from '@/hooks/video/useVideoExporter';
import { frameSize } from '@/lib/desktop/deskStyleConfig';
import { buildCaptionFile, CAPTION_FILE_MIME, type CaptionFileKind } from '@/lib/desktop/captionFiles';
import type { DeskState } from '@/lib/desktop/deskState';
import { OrdioMark } from '@/components/ui/OrdioMark';
import { RadioDot } from '@/components/ui/SheetGlyphs';
import { DeskSheet, DeskSheetHeader, DeskSheetLabel } from './DeskSheet';

const KINDS = [
  { id: 'mp4', label: 'Video', hint: 'MP4 with captions burned in' },
  { id: 'srt', label: 'SRT', hint: 'Subtitles for any platform' },
  { id: 'vtt', label: 'VTT', hint: 'Web captions' },
  { id: 'txt', label: 'Transcript', hint: 'Plain text, a line per caption' },
] as const;

const FILE_EXT: Record<CaptionFileKind, string> = { srt: 'srt', vtt: 'vtt', txt: 'txt' };

interface ExportSheetProps {
  state: DeskState;
  words: Word[];
  patch: (patch: Partial<DeskState>) => void;
  onClose: () => void;
  onStart: () => void;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveBlob(blob: Blob | string, filename: string) {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-2 self-start rounded-full bg-[var(--ord-paper)]/8 px-3 font-[family-name:var(--font-mono)] text-xs tracking-widest text-[var(--text-body)]">
      {children}
    </div>
  );
}

export function ExportSheet({ state, words, patch, onClose, onStart }: ExportSheetProps) {
  const isVideo = state.exKind === 'mp4';
  const exporter = useVideoExporter();
  const audioBuffer = useCaptureStore((s) => s.mixedBuffer ?? s.audioBuffer);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedAt = useRef<number | null>(null);
  const [, tick] = useState(0);
  const [bytes, setBytes] = useState<number | null>(null);
  const { width, height } = frameSize(state.format);
  const duration = audioBuffer?.duration ?? state.lines.at(-1)?.end ?? 0;
  const subtitle = [state.clipName, duration > 0 ? clock(duration) : null].filter(Boolean).join(' · ');

  const runExport = useCallback(async () => {
    if (!audioBuffer) return;

    /* The encoder draws every frame onto this canvas. It is mounted in the
       running card's left column, so what you watch is what is encoding —
       which is why it has to exist before the card switches to running. */
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvasRef.current = canvas;

    startedAt.current = Date.now();
    onStart();

    /* The style is already in the store — `useDeskStyleSync` publishes every
       desk edit as it happens. */
    await exporter.startExport(canvas, audioBuffer, true);
  }, [audioBuffer, exporter, onStart, width, height]);

  const downloadText = useCallback(
    (kind: CaptionFileKind) => {
      const cues = state.lines.length
        ? state.lines
        : words.map((w) => ({ start: w.start, end: w.end, words: [w] }));
      const body = buildCaptionFile(kind, cues);
      saveBlob(new Blob([body], { type: `${CAPTION_FILE_MIME[kind]};charset=utf-8` }), `ordio-${Date.now()}.${FILE_EXT[kind]}`);
      toast.success(`${KINDS.find((k) => k.id === kind)?.label} downloaded`);
      onClose();
    },
    [state.lines, words, onClose]
  );

  /* Progress and completion come from the encoder, not a timer. */
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
      notifyError(exporter.error);
      patch({ exStage: 'setup', exportPct: 0 });
    }
  }, [exporter.error, state.exStage, patch]);

  /* A once-a-second tick so the time-left line moves between progress events. */
  useEffect(() => {
    if (state.exStage !== 'running') return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [state.exStage]);

  useEffect(() => {
    if (!exporter.exportedUrl) return;
    let cancelled = false;
    fetch(exporter.exportedUrl)
      .then((r) => r.blob())
      .then((blob) => !cancelled && setBytes(blob.size))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [exporter.exportedUrl]);

  const mountCanvas = useCallback((host: HTMLDivElement | null) => {
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    host.appendChild(canvas);
  }, []);

  const download = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    saveBlob(exporter.exportedUrl, `ordio-${Date.now()}.${ext}`);
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  const pct = Math.max(0, Math.min(100, state.exportPct));
  const elapsed = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
  const timeLeft = pct >= 8 && pct < 100 && elapsed > 0 ? `About ${clock((elapsed * (100 - pct)) / pct)} left · ` : '';
  const outputLine = `${width}×${height} · ${(exporter.exportMimeType ? fileExtension(exporter.exportMimeType) : 'mp4').toUpperCase()}`;
  const previewAspect = { aspectRatio: `${width} / ${height}` };

  if (state.exStage === 'setup') {
    return (
      <DeskSheet title="Export" onClose={onClose}>
        <DeskSheetHeader title="Export" subtitle={subtitle || undefined} onClose={onClose} />

        <DeskSheetLabel>What you get</DeskSheetLabel>
        <div role="radiogroup" aria-label="What you get" className="-mt-1.5 grid grid-cols-2 gap-2">
          {KINDS.map((kind) => {
            const on = state.exKind === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => patch({ exKind: kind.id })}
                className={sheetOption({ selected: on })}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-[var(--ord-paper)]">{kind.label}</span>
                  <span className="truncate text-xs text-[var(--text-muted)]">{kind.hint}</span>
                </span>
                <RadioDot on={on} />
              </button>
            );
          })}
        </div>

        {isVideo ? (
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--ord-paper)]/5 px-3.5 py-3">
            <span className="text-[13px] text-[var(--text-muted)]">
              Every export carries a small ordio mark in the corner.
            </span>
            <span className="flex-none font-[family-name:var(--font-mono)] text-xs text-[var(--text-body)]">
              {width}×{height}
            </span>
          </div>
        ) : (
          <>
            <DeskSheetLabel>Preview</DeskSheetLabel>
            <pre className="-mt-1.5 m-0 max-h-40 overflow-auto rounded-[14px] bg-[var(--ord-ink)] p-3 font-[family-name:var(--font-mono)] text-xs whitespace-pre-wrap text-[var(--text-body)]">
              {buildCaptionFile(state.exKind as CaptionFileKind, state.lines.slice(0, 3)) || 'Nothing to export yet.'}
            </pre>
          </>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={cn(sheetButton({ tone: 'secondary' }), 'h-11 w-auto px-4.5 text-sm')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={isVideo ? runExport : () => downloadText(state.exKind as CaptionFileKind)}
            disabled={words.length === 0 || (isVideo && !audioBuffer)}
            className={cn(sheetButton({ tone: 'primary' }), 'h-11 w-auto px-5 text-sm')}
          >
            {isVideo ? 'Export video' : `Download ${KINDS.find((k) => k.id === state.exKind)?.label}`}
          </button>
        </div>
      </DeskSheet>
    );
  }

  return (
    <DeskSheet title={state.exStage === 'running' ? 'Exporting' : 'Export ready'} onClose={onClose} width="split" bleed>
      <div className="flex min-h-0 h-150 max-h-[calc(100dvh-32px)]">
        <div className="flex w-70 flex-none flex-col items-center justify-center gap-4 bg-[var(--ord-stage)] p-6">
          <div
            className="relative max-h-87 w-49 overflow-hidden rounded-[18px] border border-[var(--ord-paper)]/12 bg-[var(--ord-ink)]"
            style={previewAspect}
          >
            {state.exStage === 'done' && exporter.exportedUrl ? (
              <video src={exporter.exportedUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
            ) : (
              <div ref={mountCanvas} className="h-full w-full" aria-label="Frame being encoded" />
            )}
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">{outputLine}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-8">
          {state.exStage === 'running' ? (
            <>
              <StatusPill>
                <OrdioMark motion="pulse" size={30} />
                EXPORTING
              </StatusPill>
              <div className="flex flex-col gap-1.5 pt-7">
                <span
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Export progress"
                  className="font-[family-name:var(--font-mono)] text-6xl leading-none tracking-tighter text-[var(--ord-paper)] tabular-nums"
                >
                  {pct}
                  <span className="text-[var(--text-muted)]">%</span>
                </span>
                <span className="text-[13px] text-[var(--text-muted)]">
                  {timeLeft}encoding on this computer, keep the tab open
                </span>
              </div>
              <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ord-paper)]/10" aria-hidden="true">
                <div className="h-full rounded-full bg-[var(--ord-acid)] transition-[width] duration-[var(--dur-snap)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex-1" />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    exporter.cancelExport();
                    patch({ exStage: 'setup', exportPct: 0 });
                  }}
                  className={cn(sheetButton({ tone: 'secondary' }), 'h-11 w-auto px-4.5 text-sm')}
                >
                  Cancel export
                </button>
              </div>
            </>
          ) : (
            <>
              <StatusPill>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.5l2.2 2.2L9.5 3.5" stroke="var(--ord-acid)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                READY
              </StatusPill>
              <h2 className="m-0 pt-7 text-[32px] font-bold tracking-[-0.03em] text-[var(--ord-paper)]">
                Ready to <span className="font-[family-name:var(--acid-font-serif)] text-[38px] font-normal italic">post</span>
              </h2>
              {/* The encoder hands back a blob URL — a file to download, not
                  something saved anywhere yet. */}
              <p className="m-0 mt-2 text-sm text-[var(--text-muted)]">Download it, then post it wherever it is going.</p>
              <dl className="m-0 mt-6 grid grid-cols-3 gap-2 rounded-[22px] border border-[var(--border-hairline)] bg-[var(--ord-panel)] px-4.5 py-3.5">
                {[
                  ['Size', `${width}×${height}`],
                  ['Length', clock(duration)],
                  ['File', bytes === null ? '—' : formatBytes(bytes)],
                ].map(([term, value]) => (
                  <div key={term} className="flex min-w-0 flex-col gap-1">
                    <dt className="text-[11px] text-[var(--text-muted)]">{term}</dt>
                    <dd className="m-0 truncate font-[family-name:var(--font-mono)] text-sm text-[var(--ord-paper)]">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex-1" />
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className={cn(sheetButton({ tone: 'secondary' }), 'h-11 w-auto px-4.5 text-sm')}>
                  Done
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={!exporter.exportedUrl}
                  className={cn(sheetButton({ tone: 'primary' }), 'h-11 w-auto px-5 text-sm')}
                >
                  Download
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DeskSheet>
  );
}
