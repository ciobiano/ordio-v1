'use client';

import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet';
import { DangerBadge } from '@/components/ui/SheetGlyphs';
import { sheetButton } from '@/lib/variants';

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
    <OrdSheet
      open
      onOpenChange={(open) => !open && onDismiss()}
      role="alertdialog"
      title="Something went wrong"
      description={message}
      icon={<DangerBadge kind="alert" />}
      footer={
        partialAvailable ? (
          <OrdSheetActions>
            <button type="button" className={sheetButton({ tone: 'secondary' })} onClick={onDismiss}>
              Dismiss
            </button>
            <button type="button" className={sheetButton({ tone: 'primary' })} onClick={onUsePartial}>
              Use partial transcript
            </button>
          </OrdSheetActions>
        ) : (
          <button type="button" className={sheetButton({ tone: 'secondary' })} onClick={onDismiss}>
            Dismiss
          </button>
        )
      }
    />
  );
}
