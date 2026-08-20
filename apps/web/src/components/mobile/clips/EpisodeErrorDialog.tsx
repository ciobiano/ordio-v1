'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EpisodeErrorDialogProps {
  message: string;
  partialAvailable: boolean;
  onUsePartial: () => void;
  onDismiss: () => void;
}

/**
 * Error state for the long-episode clip-finder pipeline. Always renders a
 * dismiss control (design rule: every async state has an exit); when a
 * chunk failed but earlier chunks transcribed successfully, offers to
 * proceed with the partial transcript instead of discarding the work.
 */
export function EpisodeErrorDialog({
  message,
  partialAvailable,
  onUsePartial,
  onDismiss,
}: EpisodeErrorDialogProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onDismiss()}>
      <AlertDialogContent
        className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white"
      >
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-white">Something went wrong</AlertDialogTitle>
          <AlertDialogDescription className="text-white/55">{message}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
            Dismiss
          </AlertDialogCancel>
          {partialAvailable && (
            <AlertDialogAction
              onClick={onUsePartial}
              className="rounded-2xl bg-white text-slate-950 hover:bg-white/90"
            >
              Use partial transcript
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
