'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, Delete01Icon, ScissorIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type CaptionEditorHeaderProps = {
  selectedGroupIdx: number | null;
  cursorPosition: number | null;
  canSplit: boolean;
  canMergeUp: boolean;
  canMergeDown: boolean;
  onSplit: () => void;
  onMergeUp: () => void;
  onMergeDown: () => void;
  onDelete: () => void;
};

export function CaptionEditorHeader({
  selectedGroupIdx,
  cursorPosition,
  canSplit,
  canMergeUp,
  canMergeDown,
  onSplit,
  onMergeUp,
  onMergeDown,
  onDelete,
}: CaptionEditorHeaderProps) {
  return (
    <div className="sticky top-0 z-10 shrink-0 bg-background/95 backdrop-blur">
      <div className="px-3 py-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
          Edit captions
        </p>
      </div>

      <Separator />

      {selectedGroupIdx !== null && (
        <>
          <div
            className="flex items-center justify-around px-2 py-2 gap-1 bg-white/[0.02] border-b border-white/[0.04]"
            role="toolbar"
            aria-label="Caption actions"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onSplit}
              disabled={!canSplit}
              aria-label={cursorPosition !== null ? 'Split at cursor position' : 'Split at playhead'}
              className="flex-1 gap-1.5 text-xs"
            >
              <HugeiconsIcon icon={ScissorIcon} size={14} aria-hidden="true" />
              {cursorPosition !== null ? 'Split here' : 'Split'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onMergeUp}
              disabled={!canMergeUp}
              aria-label="Merge with previous caption"
              className="flex-1 gap-1.5 text-xs"
            >
              <HugeiconsIcon icon={ArrowUp01Icon} size={14} aria-hidden="true" />
              Merge ↑
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onMergeDown}
              disabled={!canMergeDown}
              aria-label="Merge with next caption"
              className="flex-1 gap-1.5 text-xs"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} aria-hidden="true" />
              Merge ↓
            </Button>

            {/* Removes the caption, never the audio. The words stay in the
                transcript so nothing after this shifts in time — that span just
                plays with no caption over it. Undo covers it, so it does not
                need a confirm; cutting audio is the Trim panel's job. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label="Delete this caption"
              className="flex-1 gap-1.5 text-xs text-[color:var(--acid-error)] hover:text-[color:var(--acid-error)]"
            >
              <HugeiconsIcon icon={Delete01Icon} size={14} aria-hidden="true" />
              Delete
            </Button>
          </div>
          <Separator />
        </>
      )}
    </div>
  );
}

