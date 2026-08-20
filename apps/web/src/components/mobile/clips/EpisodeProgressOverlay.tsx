'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';

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
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent
        className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white"
      >
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-white">{PHASE_LABELS[phase]}</AlertDialogTitle>
          <AlertDialogDescription className="text-white/55">
            This can take a few minutes for longer episodes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Progress value={progress} />
          <span className="text-xs text-white/40 tabular-nums">{Math.round(progress)}%</span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10"
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
