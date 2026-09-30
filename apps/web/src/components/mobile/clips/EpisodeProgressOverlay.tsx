'use client';

import { OrdSheet } from '@/components/ui/OrdSheet';
import { sheetButton } from '@/lib/variants';

type EpisodePhase = 'ingesting' | 'transcribing' | 'finding';

const PHASE_LABELS: Record<EpisodePhase, string> = {
  ingesting: 'Reading your episode…',
  transcribing: 'Transcribing…',
  finding: 'Finding your best moments…',
};

interface EpisodeProgressOverlayProps {
  phase: EpisodePhase;
  progress: number;
  onCancel: () => void;
}

/**
 * Blocking progress dialog for the long-episode clip-finder pipeline.
 * Every async state needs an explicit exit (design rule) — always renders
 * a Cancel control wired to onCancel, no auto-dismiss.
 */
export function EpisodeProgressOverlay({ phase, progress, onCancel }: EpisodeProgressOverlayProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <OrdSheet
      open
      onOpenChange={(open) => !open && onCancel()}
      role="alertdialog"
      title={PHASE_LABELS[phase]}
      description="This can take a few minutes for longer episodes."
      footer={
        <button type="button" onClick={onCancel} className={sheetButton({ tone: 'secondary' })}>
          Cancel
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Episode progress"
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-acid-text-1/8"
        >
          <div className="h-full rounded-full bg-acid-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-acid-mono text-xs text-acid-text-3 tabular-nums">{pct}%</span>
      </div>
    </OrdSheet>
  );
}
