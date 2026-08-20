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
import { formatFileSize, formatMediaType } from '@/lib/formatFileSize';

interface FileConfirmDialogProps {
  file: File | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * HIG-style confirmation dialog shown after a user selects a file for upload.
 * Displays file name, size, and format — lets the user confirm before
 * committing to the processing pipeline.
 *
 * Follows the same AlertDialog pattern as DiscardDialog and SavedAudioDialogs.
 */
export function FileConfirmDialog({ file, onConfirm, onCancel }: FileConfirmDialogProps) {
  return (
    <AlertDialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent
        className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white"
      >
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-white">Process this file?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/55">
            Confirm the audio you&apos;d like to process.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {file && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-xs font-semibold text-white/70">
              {formatMediaType(file)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="mt-0.5 text-xs text-white/40">{formatFileSize(file.size)}</p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-2xl bg-white text-slate-950 hover:bg-white/90"
          >
            Process audio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
