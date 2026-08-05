'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Delete01Icon,
  MoreHorizontalIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** How far the row travels to expose the delete action. Matches its width. */
const SWIPE_REVEAL_PX = 80;
/** Past this, releasing leaves the row open rather than springing back. */
const SWIPE_COMMIT_PX = 40;
/** How far the hint peeks — enough to show red, short of looking committed. */
const HINT_PEEK_PX = 64;
/** The iOS sheet curve, shared with the export panels. */
const ROW_EASE = [0.32, 0.72, 0, 1] as const;

export interface RecordingRowSession {
  id: string;
  name: string;
  durationMs: number;
  createdAt: number;
}

interface RecordingRowProps {
  session: RecordingRowSession;
  meta: string;
  isSwipeOpen: boolean;
  onSwipeOpenChange: (open: boolean) => void;
  /** Play the teaching animation on this row. */
  isHinting: boolean;
  onHintPlayed: () => void;
  onUserSwiped: () => void;
  onSelect: () => void;
  onRequestDelete: () => void;
  onRename: (title: string) => Promise<void>;
}

/**
 * One recording: tap to open, swipe left to delete, ⋯ for rename or delete.
 *
 * Extracted from CaptureSidebar, which was already 289 lines before this row
 * grew a menu and an editing state.
 *
 * Swipe is an accelerator, not the only route — the ⋯ menu carries both actions
 * where they can be seen.
 *
 * The long-press that used to open a delete confirm is gone with it. It was an
 * invisible gesture whose only outcome was destructive, which made every
 * accidental hold on a list item a small scare; ⋯ now covers that ground in the
 * open, and holding a row does nothing.
 */
export function RecordingRow({
  session,
  meta,
  isSwipeOpen,
  onSwipeOpenChange,
  isHinting,
  onHintPlayed,
  onUserSwiped,
  onSelect,
  onRequestDelete,
  onRename,
}: RecordingRowProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Return can fire alongside the confirm button on some soft keyboards; this
   *  keeps the save to one call. */
  const settledRef = useRef(false);

  /**
   * The hint is a motion demonstration and nothing else, so under
   * prefers-reduced-motion it is not softened — it is skipped. Retiring it
   * immediately keeps the counter honest rather than leaving it queued forever,
   * and these users lose nothing they cannot reach: ⋯ carries both actions.
   */
  const animateHint = isHinting && !reduceMotion;
  useEffect(() => {
    if (isHinting && reduceMotion) onHintPlayed();
  }, [isHinting, reduceMotion, onHintPlayed]);

  const beginRename = useCallback(() => {
    setDraft(session.name);
    settledRef.current = false;
    setIsEditing(true);
    onSwipeOpenChange(false);
  }, [session.name, onSwipeOpenChange]);

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Select rather than place a caret: the existing name is usually an
    // auto-generated timestamp the user wants gone, not text to edit.
    input.select();
  }, [isEditing]);

  const commit = useCallback(async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    setIsEditing(false);

    const next = draft.trim();
    // The mutation rejects an empty title, and renaming to what it already says
    // is a wasted round trip.
    if (next.length === 0 || next === session.name) return;
    await onRename(next);
  }, [draft, session.name, onRename]);

  const cancel = useCallback(() => {
    settledRef.current = true;
    setIsEditing(false);
    setDraft(session.name);
  }, [session.name]);

  return (
    <div className="relative mb-0.5 overflow-hidden rounded-[10px]">
      <button
        type="button"
        onClick={onRequestDelete}
        aria-label={`Delete ${session.name}`}
        tabIndex={isSwipeOpen ? 0 : -1}
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[#ff453a] text-white"
      >
        <HugeiconsIcon icon={Delete01Icon} size={18} strokeWidth={2} />
      </button>

      <motion.div
        // Dragging while a field is focused would fight the text selection, and
        // there is nothing to reveal that the open menu does not already offer.
        drag={isEditing ? false : 'x'}
        dragConstraints={{ left: -SWIPE_REVEAL_PX, right: 0 }}
        dragElastic={0.06}
        dragMomentum={false}
        animate={
          animateHint
            ? { x: [0, -HINT_PEEK_PX, 0] }
            : { x: isSwipeOpen ? -SWIPE_REVEAL_PX : 0 }
        }
        transition={
          animateHint
            ? // Slow enough to be read as a demonstration rather than a glitch,
              // and held briefly at the open position so the red registers.
              { delay: 0.7, duration: 1.4, times: [0, 0.45, 1], ease: ROW_EASE }
            : { duration: 0.22, ease: ROW_EASE }
        }
        onAnimationComplete={() => {
          if (animateHint) onHintPlayed();
        }}
        onDragEnd={(_, info) => {
          const opened = info.offset.x < -SWIPE_COMMIT_PX;
          onSwipeOpenChange(opened);
          // Any deliberate travel counts as learning the gesture, even if the
          // release fell short of opening.
          if (info.offset.x < -SWIPE_COMMIT_PX / 2) onUserSwiped();
        }}
        className="relative flex items-center bg-[color:var(--sheet-bg)]"
      >
        {isEditing ? (
          /* Cancel then confirm, both trailing the field.
             A phone keyboard has Return but no Escape, so without these there
             was no way to abandon a rename — only to commit it or tap away and
             hope. The order is the nav-bar convention (Cancel leading, Done
             trailing) held on one row: cancel reads first, confirm sits
             rightmost where the thumb lands and carries the accent as the one
             committing action. */
          <div className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pl-2 pr-1">
            <input
              ref={inputRef}
              value={draft}
              aria-label="Recording name"
              enterKeyHint="done"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commit();
                } else if (event.key === 'Escape') {
                  // Hardware keyboards only, but free to support.
                  event.preventDefault();
                  cancel();
                }
              }}
              className={cn(
                'min-w-0 flex-1 rounded-lg bg-white/8 px-2.5 py-2 text-base text-white',
                'outline-none ring-2 ring-[color:var(--acid-accent-ring)]'
              )}
            />

            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel rename"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                // Quiet, and deliberately not red: abandoning an edit discards a
                // draft, it does not destroy anything.
                'text-white/55 transition-colors hover:bg-white/8 hover:text-white/85',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[color:var(--acid-accent-ring)]'
              )}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              onClick={() => void commit()}
              disabled={draft.trim().length === 0}
              aria-label="Save name"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                // The one commit action here, so it takes the accent.
                'bg-[color:var(--acid-accent)] text-[color:var(--acid-on-accent)]',
                'transition-opacity hover:opacity-90',
                // A name cannot be blank — the mutation rejects it — so the
                // control says so rather than letting the tap fail.
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[color:var(--acid-accent-ring)]'
              )}
            >
              <HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2.8} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                // A tap while the delete is exposed dismisses it rather than
                // opening the recording — otherwise the row underneath acts on
                // a tap the user meant as "never mind".
                if (isSwipeOpen) {
                  onSwipeOpenChange(false);
                  return;
                }
                onSelect();
              }}
              className="min-w-0 flex-1 cursor-pointer truncate px-3 py-3 text-left text-base text-white/85 hover:bg-white/5"
            >
              {session.name}
              <span className="block font-mono text-[13px] text-white/40">{meta}</span>
            </button>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                aria-label={`Options for ${session.name}`}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                  'text-white/45 transition-colors hover:bg-white/8 hover:text-white/80',
                  'focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-[color:var(--acid-accent-ring)]'
                )}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={2.4} />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom" className="w-44 p-1.5">
                <DropdownMenuItem onClick={beginRename} className="cursor-pointer">
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onRequestDelete}
                  variant="destructive"
                  className="cursor-pointer"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </motion.div>
    </div>
  );
}
