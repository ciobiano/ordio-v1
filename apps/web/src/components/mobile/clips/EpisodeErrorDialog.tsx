'use client';

import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet';
import { DangerBadge } from '@/components/ui/SheetGlyphs';
import { sheetButton } from '@/lib/variants';
import { OrdioError } from '@/lib/errors/OrdioError';
import { ErrorReference } from '@/lib/errors/notify';

interface EpisodeErrorDialogProps {
  error: OrdioError | null;
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
  error,
  partialAvailable,
  onUsePartial,
  onDismiss,
}: EpisodeErrorDialogProps) {
  const failure = error ?? new OrdioError('EPISODE_FAILED');
  return (
    <OrdSheet
      open
      onOpenChange={(open) => !open && onDismiss()}
      role="alertdialog"
      title={failure.copy.title}
      description={
        <>
          {failure.copy.detail}
          <ErrorReference code={failure.code} />
        </>
      }
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
