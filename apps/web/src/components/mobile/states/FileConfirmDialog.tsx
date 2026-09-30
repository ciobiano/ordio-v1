'use client';

import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet';
import { sheetButton } from '@/lib/variants';
import { formatFileSize, formatMediaType } from '@/lib/formatFileSize';

interface FileConfirmDialogProps {
  file: File | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown after a user selects a file for upload. Displays file
 * name, size, and format — lets the user confirm before committing to the
 * processing pipeline.
 */
export function FileConfirmDialog({ file, onConfirm, onCancel }: FileConfirmDialogProps) {
  return (
    <OrdSheet
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      role="alertdialog"
      title="Process this file?"
      description="Confirm the audio you'd like to process."
      footer={
        <OrdSheetActions>
          <button type="button" className={sheetButton({ tone: 'secondary' })} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={sheetButton({ tone: 'primary' })} onClick={onConfirm}>
            Process audio
          </button>
        </OrdSheetActions>
      }
    >
      {file && (
        <div className="flex items-center gap-3 rounded-[14px] bg-acid-text-1/5 p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-acid-text-1/8 font-acid-mono text-[11px] text-acid-text-2">
            {formatMediaType(file)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[15px] font-medium text-acid-text-1">{file.name}</p>
            <p className="m-0 mt-0.5 font-acid-mono text-xs text-acid-text-3">{formatFileSize(file.size)}</p>
          </div>
        </div>
      )}
    </OrdSheet>
  );
}
