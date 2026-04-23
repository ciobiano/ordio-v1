'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useProcessingStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon,
  ScissorIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  MoreHorizontalIcon,
  Undo02Icon,
  Redo02Icon,
} from '@hugeicons/core-free-icons';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';

// ─── Variants ─────────────────────────────────────────────────────────────

const captionRow = cva(
  'group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-100 cursor-pointer border-l-2 outline-none min-h-[52px] focus-visible:ring-1 focus-visible:ring-ring/50',
  {
    variants: {
      state: {
        idle:     'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
        active:   'border-accent text-foreground bg-accent/5',
        selected: 'border-white/20 text-foreground bg-white/[0.04]',
      },
    },
    defaultVariants: { state: 'idle' },
  }
);

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface CaptionEditorProps {
  currentTime: number;
  onSeek?: (time: number) => void;
  isTranscribing?: boolean;
  trimmer?: UseAudioTrimmerReturn;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CaptionEditor({ currentTime, onSeek, isTranscribing }: CaptionEditorProps) {
  const transcript         = useProcessingStore((s) => s.transcript);
  const captionGroups      = useProcessingStore((s) => s.captionGroups);
  const selectedGroupIndices = useProcessingStore((s) => s.selectedGroupIndices);
  const captionUndoStack   = useProcessingStore((s) => s.captionUndoStack);
  const captionRedoStack   = useProcessingStore((s) => s.captionRedoStack);
  const splitAtWord           = useProcessingStore((s) => s.splitAtWord);
  const splitAtTime           = useProcessingStore((s) => s.splitAtTime);
  const mergeDown             = useProcessingStore((s) => s.mergeDown);
  const mergeUp               = useProcessingStore((s) => s.mergeUp);
  const mergeUpAtCursor       = useProcessingStore((s) => s.mergeUpAtCursor);
  const mergeDownAtCursor     = useProcessingStore((s) => s.mergeDownAtCursor);
  const selectGroup           = useProcessingStore((s) => s.selectGroup);
  const clearSelection        = useProcessingStore((s) => s.clearSelection);
  const undoCaptions          = useProcessingStore((s) => s.undoCaptions);
  const redoCaptions          = useProcessingStore((s) => s.redoCaptions);

  // The word position within the selected group where the cursor sits.
  // cursorPosition = N means the cursor is before word[N], so:
  //   - words [0..N-1] stay in segment A
  //   - word[N] and onwards become segment B
  // null = no cursor placed yet (Split will use playhead time instead)
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  // The single selected group index (last clicked)
  const selectedGroupIdx = selectedGroupIndices.length > 0
    ? selectedGroupIndices[selectedGroupIndices.length - 1]
    : null;

  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const canUndo = captionUndoStack.length > 0;
  const canRedo = captionRedoStack.length > 0;

  // Auto-scroll active group into view during playback
  useEffect(() => {
    const activeIdx = captionGroups.findIndex(
      (g) => currentTime >= g.start && currentTime < g.end
    );
    if (activeIdx < 0) return;
    groupRefs.current.get(activeIdx)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTime, captionGroups]);

  // Clear cursor when selection changes
  useEffect(() => {
    setCursorPosition(null);
  }, [selectedGroupIdx]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Escape') {
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoCaptions();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redoCaptions();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, undoCaptions, redoCaptions]);

  const setGroupRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) groupRefs.current.set(idx, el);
    else groupRefs.current.delete(idx);
  }, []);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleSplit = useCallback(() => {
    if (selectedGroupIdx === null) return;
    if (cursorPosition !== null) {
      // Cursor-based split: cursor is before cursorPosition, so that word starts segment B
      splitAtWord(selectedGroupIdx, cursorPosition);
      setCursorPosition(null);
    } else {
      // Playhead-based split: no cursor placed
      splitAtTime(selectedGroupIdx, currentTime);
    }
  }, [selectedGroupIdx, cursorPosition, splitAtWord, splitAtTime, currentTime]);

  const handleMergeUp = useCallback(() => {
    if (selectedGroupIdx === null || selectedGroupIdx <= 0) return;
    // If cursor is set: send words before cursor up; words from cursor stay
    // If no cursor: merge entire group up (CapCut default)
    mergeUpAtCursor(selectedGroupIdx, cursorPosition);
    setCursorPosition(null);
  }, [selectedGroupIdx, cursorPosition, mergeUpAtCursor]);

  const handleMergeDown = useCallback(() => {
    if (selectedGroupIdx === null || selectedGroupIdx >= captionGroups.length - 1) return;
    // If cursor is set: send words from cursor down; words before cursor stay
    // If no cursor: merge entire group down (CapCut default)
    mergeDownAtCursor(selectedGroupIdx, cursorPosition);
    setCursorPosition(null);
  }, [selectedGroupIdx, cursorPosition, captionGroups.length, mergeDownAtCursor]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (isTranscribing) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-sm text-muted-foreground">Transcribing audio…</p>
        <p className="text-xs text-muted-foreground/60">This may take a moment</p>
      </div>
    );
  }

  if (!transcript || transcript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-sm text-muted-foreground">No captions available</p>
        <p className="text-xs text-muted-foreground/60">
          Check microphone permissions or try again
        </p>
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const canSplit = selectedGroupIdx !== null && captionGroups[selectedGroupIdx]?.wordIndices.length >= 2;
  const canMergeUp = selectedGroupIdx !== null && selectedGroupIdx > 0;
  const canMergeDown = selectedGroupIdx !== null && selectedGroupIdx < captionGroups.length - 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="region"
      aria-label="Caption editor"
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
          Edit captions
        </p>
        {selectedGroupIdx !== null && (
          <button
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            Done
          </button>
        )}
      </div>

      <Separator />

      {/* Caption list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col py-1" role="list">
          {captionGroups.map((group, gi) => {
            const isActive   = currentTime >= group.start && currentTime < group.end;
            const isSelected = selectedGroupIdx === gi;
            const rowState   = isActive ? 'active' : isSelected ? 'selected' : 'idle';
            const selectedGroup = captionGroups[gi];

            return (
              <div key={gi} role="listitem">
                {/* Group row: left column (icon+time) pinned top, text fills right */}
                <div
                  ref={(el) => setGroupRef(gi, el)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectGroup(gi, false);
                      onSeek?.(group.start);
                    }
                  }}
                  onClick={() => {
                    selectGroup(gi, false);
                    onSeek?.(group.start);
                  }}
                  aria-label={`Caption at ${formatTimestamp(group.start)}: ${group.text}`}
                  aria-pressed={isSelected}
                  className={captionRow({ state: rowState })}
                >
                  {/* Left column: icon + timestamp, stays pinned to top */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
                    <HugeiconsIcon
                      icon={PlayIcon}
                      size={11}
                      className={cn(
                        'transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground/40'
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-xs tabular-nums text-muted-foreground font-mono w-10">
                      {formatTimestamp(group.start)}
                    </span>
                  </div>

                  {/* Text / cursor zone */}
                  <span className="flex-1 text-sm leading-relaxed">
                    {isSelected ? (
                      // Selected: words become tappable zones with cursor between them
                      <span className="flex flex-wrap items-baseline gap-x-0 gap-y-1">
                        {selectedGroup.wordIndices.map((wi, posInGroup) => {
                          const word = transcript[wi];
                          if (!word) return null;
                          const isCursorHere = cursorPosition === posInGroup;

                          return (
                            <span key={wi} className="inline-flex items-baseline">
                              {/* Cursor zone — clickable area before this word (not before the first word) */}
                              {posInGroup > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCursorPosition(
                                      isCursorHere ? null : posInGroup
                                    );
                                  }}
                                  aria-label={`Place split cursor before ${word.text}`}
                                  className="inline-flex items-center justify-center w-4 h-5 cursor-text select-none outline-none group/cursor"
                                >
                                  {isCursorHere ? (
                                    // Active cursor: blinking accent bar
                                    <span
                                      className="inline-block w-0.5 h-4 rounded-full bg-primary animate-caret-blink"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    // Inactive: invisible touch target, faint on hover
                                    <span
                                      className="inline-block w-0.5 h-3 rounded-full bg-transparent group-hover/cursor:bg-white/20 transition-colors"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              )}

                              {/* Word — plain text, no click handler on itself */}
                              <span
                                className={cn(
                                  'text-sm',
                                  isCursorHere ? 'text-foreground' : 'text-foreground/80'
                                )}
                              >
                                {word.text}
                              </span>
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      group.text
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      {/* Bottom action bar: max 3 visible + overflow dropdown */}
      <div
        className="flex items-center justify-around px-2 py-2 shrink-0 gap-1"
        role="toolbar"
        aria-label="Caption actions"
      >
        {/* Split */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSplit}
          disabled={!canSplit}
          aria-label={
            cursorPosition !== null
              ? 'Split at cursor position'
              : 'Split at playhead'
          }
          className="flex-1 gap-1.5 text-xs"
        >
          <HugeiconsIcon icon={ScissorIcon} size={14} aria-hidden="true" />
          {cursorPosition !== null ? 'Split here' : 'Split'}
        </Button>

        {/* Merge Up */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMergeUp}
          disabled={!canMergeUp}
          aria-label="Merge with previous caption"
          className="flex-1 gap-1.5 text-xs"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={14} aria-hidden="true" />
          Merge ↑
        </Button>

        {/* Merge Down */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMergeDown}
          disabled={!canMergeDown}
          aria-label="Merge with next caption"
          className="flex-1 gap-1.5 text-xs"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} aria-hidden="true" />
          Merge ↓
        </Button>

        {/* Overflow: Undo / Redo + future actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            aria-label="More caption actions"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} size={16} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuItem
              onClick={undoCaptions}
              disabled={!canUndo}
              aria-label="Undo last caption action"
            >
              <HugeiconsIcon icon={Undo02Icon} size={14} aria-hidden="true" />
              Undo
              <span className="ml-auto text-xs text-muted-foreground">⌘Z</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={redoCaptions}
              disabled={!canRedo}
              aria-label="Redo last caption action"
            >
              <HugeiconsIcon icon={Redo02Icon} size={14} aria-hidden="true" />
              Redo
              <span className="ml-auto text-xs text-muted-foreground">⌘⇧Z</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}