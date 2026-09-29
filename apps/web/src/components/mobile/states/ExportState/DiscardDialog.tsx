'use client'

import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet'
import { DangerBadge } from '@/components/ui/SheetGlyphs'
import { sheetButton } from '@/lib/variants'

interface DiscardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DiscardDialog({ open, onOpenChange, onConfirm }: DiscardDialogProps) {
  return (
    <OrdSheet
      open={open}
      onOpenChange={onOpenChange}
      role="alertdialog"
      title="Discard changes?"
      description="Your edits and recording will be lost. This cannot be undone."
      icon={<DangerBadge kind="bin" />}
      footer={
        <OrdSheetActions>
          <button type="button" className={sheetButton({ tone: 'secondary' })} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={sheetButton({ tone: 'danger' })} onClick={onConfirm}>
            Discard
          </button>
        </OrdSheetActions>
      }
    />
  )
}
