'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Redo02Icon,
  ScissorIcon,
  Undo02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type CaptionEditorHeaderProps = {
  canUndo: boolean;
  canRedo: boolean;
  selectedGroupIdx: number | null;
  cursorPosition: number | null;
  canSplit: boolean;
  canMergeUp: boolean;
  canMergeDown: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onMergeUp: () => void;
  onMergeDown: () => void;
};

export function CaptionEditorHeader({
  canUndo,
  canRedo,
  selectedGroupIdx,
  cursorPosition,
  canSplit,
  canMergeUp,
  canMergeDown,
  onUndo,
  onRedo,
  onSplit,
  onMergeUp,
  onMergeDown,
}: CaptionEditorHeaderProps) {
  return (
    <div className="sticky top-0 z-10 shrink-0 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-3 py-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
          Edit captions
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <HugeiconsIcon icon={Undo02Icon} size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <HugeiconsIcon icon={Redo02Icon} size={14} aria-hidden="true" />
          </Button>
        </div>
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
          </div>
          <Separator />
        </>
      )}
    </div>
  );
}

