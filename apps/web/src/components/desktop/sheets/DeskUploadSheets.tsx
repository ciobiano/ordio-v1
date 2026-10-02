'use client';

/**
 * The four surfaces the upload path needs, in the desk's own modal.
 *
 * None of these existed on desktop. The shell mounted the capture flow, so
 * choosing a file *started* the pipeline — but nothing rendered its states, so
 * a short file staged and waited for a confirmation dialog that was never
 * drawn, and a long file began ingesting behind a toast and then appeared to
 * hang forever. Upload was reachable and non-functional in both directions.
 *
 * Mobile draws these as bottom sheets and glass alert dialogs sized against a
 * phone. That is a gesture vocabulary, not a style: a sheet rises to the thumb
 * and is dismissed by dragging down. On a desk there is no thumb, so they use
 * DeskSheet, which already owns Escape, backdrop dismissal, focus return and
 * scroll locking.
 */

import { formatFileSize, formatMediaType } from '@/lib/formatFileSize';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { useClipPicker } from '@/hooks/clips/useClipPicker';
import { sheetButton } from '@/lib/variants';
import { cn } from '@/lib/utils';
import type { ProcessingAlertState } from '@/hooks/recording/useCreateFlow';
import { ErrorReference } from '@/lib/errors/notify';
import { OrdioError } from '@/lib/errors/OrdioError';
import { DeskSheet } from './DeskSheet';

/* The desk's sheet buttons: the same three tones as the phone's sheets, at
   the compact size a pointer needs. */
const ghostButton = cn(sheetButton({ tone: 'secondary' }), 'h-11 w-auto px-4.5 text-sm');
const commitButton = cn(sheetButton({ tone: 'primary' }), 'h-11 w-auto px-5 text-sm');

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/* ── Confirm a staged file ─────────────────────────────────────────── */

export function DeskFileConfirm({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DeskSheet title="Process this file?" onClose={onCancel}>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-[var(--ord-paper)]">
          Process this file?
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          Transcribing spends credits, so it asks first.
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-[14px] bg-[var(--ord-paper)]/5 p-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-[14px] bg-[var(--ord-paper)]/8 ord-type-micro font-bold text-[var(--text-body)]">
          {formatMediaType(file)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate ord-type-label font-semibold text-[var(--ord-paper)]">
            {file.name}
          </span>
          <span className="ord-mono">{formatFileSize(file.size)}</span>
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={ghostButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={commitButton}
        >
          Process audio
        </button>
      </div>
    </DeskSheet>
  );
}

/* ── Long episode: working ─────────────────────────────────────────── */

const EPISODE_LABEL: Record<'ingesting' | 'transcribing' | 'finding', string> = {
  ingesting: 'Reading your episode…',
  transcribing: 'Transcribing…',
  finding: 'Finding your best moments…',
};

export function DeskEpisodeProgress({
  phase,
  progress,
  onCancel,
}: {
  phase: 'ingesting' | 'transcribing' | 'finding';
  progress: number;
  onCancel: () => void;
}) {
  return (
    <DeskSheet title={EPISODE_LABEL[phase]} onClose={onCancel}>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-[var(--ord-paper)]">
          {EPISODE_LABEL[phase]}
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          This can take a few minutes for a long episode. You can cancel at any
          point and nothing is charged for work already done.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ord-paper)]/10"
        >
          <span
            className="block h-full rounded-full bg-[var(--ord-acid)] transition-[width] duration-[var(--dur-snap)]"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <span className="ord-mono tabular-nums">{Math.round(progress)}%</span>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onCancel} className={ghostButton}>
          Cancel
        </button>
      </div>
    </DeskSheet>
  );
}

/* ── Long episode: failed ──────────────────────────────────────────── */

export function DeskEpisodeError({
  error,
  partialAvailable,
  onUsePartial,
  onDismiss,
}: {
  error: OrdioError | null;
  partialAvailable: boolean;
  onUsePartial: () => void;
  onDismiss: () => void;
}) {
  const failure = error ?? new OrdioError('EPISODE_FAILED');
  return (
    <DeskSheet title={failure.copy.title} onClose={onDismiss}>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-[var(--ord-paper)]">
          {failure.copy.title}
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.4] text-[var(--text-muted)]">
          {failure.copy.detail}
        </span>
        <ErrorReference code={failure.code} />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDismiss} className={ghostButton}>
          Dismiss
        </button>
        {/* Offered only when earlier chunks transcribed before one failed —
            throwing away minutes of good work is worse than a short clip. */}
        {partialAvailable && (
          <button
            type="button"
            onClick={onUsePartial}
            className={commitButton}
          >
            Use what transcribed
          </button>
        )}
      </div>
    </DeskSheet>
  );
}

/* ── Long episode: pick a clip ─────────────────────────────────────── */

export function DeskClipPicker({
  candidates,
  episodeFile,
  episodeWords,
  onClose,
  onPicked,
}: {
  candidates: ClipCandidate[];
  episodeFile: File | null;
  episodeWords: Word[];
  onClose: () => void;
  onPicked: (sessionId: string) => void;
}) {
  const { pick, pickingIndex, busy } = useClipPicker({
    episodeFile,
    episodeWords,
    onPicked,
  });

  return (
    <DeskSheet title="Best moments" width="wide" onClose={busy ? () => {} : onClose}>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-[var(--ord-paper)]">
          Best moments
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          Ordio found{' '}
          {candidates.length === 1 ? 'one moment' : `${candidates.length} moments`} worth
          clipping. Pick one and it opens on the desk.
        </span>
      </div>

      <ul data-scroll className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {candidates.map((candidate, i) => (
          <li key={`${candidate.start}-${candidate.end}`}>
            <button
              type="button"
              disabled={busy || !episodeFile}
              onClick={() => pick(candidate, i)}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-1 rounded-[14px] border p-3 text-left',
                'transition-colors duration-[var(--dur-tap)] disabled:cursor-default',
                pickingIndex === i
                  ? 'border-[1.5px] border-[var(--ord-acid)] bg-[var(--ord-acid)]/7'
                  : 'border-transparent bg-[var(--ord-paper)]/5 hover:bg-[var(--ord-paper)]/8',
                busy && pickingIndex !== i && 'opacity-40'
              )}
            >
              <span className="ord-mono">
                {formatTime(candidate.start)} – {formatTime(candidate.end)}
              </span>
              <span className="ord-type-label text-[var(--ord-paper)]">
                &ldquo;{candidate.hookText}&rdquo;
              </span>
              <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
                {pickingIndex === i ? 'Preparing clip…' : candidate.rationale}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
          Cancel
        </button>
      </div>
    </DeskSheet>
  );
}

/* ── Processing failed ─────────────────────────────────────────────── */

export function DeskProcessingAlert({
  alert,
  onDisableEnhancement,
  onDismiss,
}: {
  alert: ProcessingAlertState;
  onDisableEnhancement: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="ord-animate-fade fixed top-4 left-1/2 z-70 w-[min(92vw,34rem)] -translate-x-1/2 rounded-[22px] border border-[var(--ord-rose)]/40 bg-[var(--surface-raised)] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.6)]"
    >
      <div className="flex flex-col gap-1">
        <span className="ord-type-label font-bold text-[var(--ord-rose)]">
          {alert.title}
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.45] text-[var(--text-body)]">
          {alert.detail}
        </span>
        <ErrorReference code={alert.code} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {/* Only offered when enhancement is what failed. Retrying with it off
            is the one action that changes the outcome. */}
        {alert.stage === 'enhancement' && (
          <button type="button" onClick={onDisableEnhancement} className={ghostButton}>
            Turn enhancement off
          </button>
        )}
        <button type="button" onClick={onDismiss} className={ghostButton}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
