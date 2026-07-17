'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Plus, Settings, Trash } from 'griddy-icons';
import { api } from '@Ordio/convex';
import { captureGlossyBtn } from '@/lib/variants';
import { formatDuration } from '@/components/saved-audio/formatters';
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

const PAGE_SIZE = 8;

/** Swipe-to-delete discoverability (HIG: never rely on an invisible gesture).
 * First visit with recordings present: the top row peeks open to flash the
 * delete action, then springs back. Shown once, remembered here. Long-press
 * remains the permanent alternate path to delete. */
const SWIPE_HINT_SEEN_KEY = 'ordio-swipe-delete-hint-seen';
const LONG_PRESS_MS = 500;

function formatRecentMeta(durationMs: number, createdAt: number): string {
  const created = new Date(createdAt);
  const now = new Date();
  const isToday = created.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = created.toDateString() === yesterday.toDateString();

  const day = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : created.toLocaleDateString(undefined, { weekday: 'short' });

  return `${formatDuration(durationMs)} · ${day}`;
}

interface CaptureSidebarProps {
  onOpenUpload: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function CaptureSidebar({ onOpenUpload, onOpenSettings, onClose }: CaptureSidebarProps) {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  const { results: sessions } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    isAuthenticated ? {} : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const handleSelect = (sessionId: string) => {
    router.push(`/create/export/${sessionId}`);
    onClose();
  };

  const deleteSession = useMutation(api.sessions.deleteSession);
  const [pendingDelete, setPendingDelete] = useState<(typeof sessions)[number] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const [hintRowId, setHintRowId] = useState<string | null>(null);
  const hintQueuedRef = useRef(false);
  useEffect(() => {
    if (hintQueuedRef.current || sessions.length === 0) return;
    if (localStorage.getItem(SWIPE_HINT_SEEN_KEY)) return;
    hintQueuedRef.current = true;
    setHintRowId(sessions[0].id);
  }, [sessions]);

  const completeHint = useCallback(() => {
    localStorage.setItem(SWIPE_HINT_SEEN_KEY, '1');
    setHintRowId(null);
  }, []);

  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const beginLongPress = useCallback((session: (typeof sessions)[number]) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setPendingDelete(session);
    }, LONG_PRESS_MS);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  useEffect(() => cancelLongPress, [cancelLongPress]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSession({ sessionId: pendingDelete.id });
    } catch {
      toast.error('Failed to delete recording');
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
      setSwipeOpenId(null);
    }
  }, [deleteSession, pendingDelete]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-5.5 pb-4">
        <span className="text-2xl font-bold text-white">Recordings</span>
        <button type="button" className={captureGlossyBtn} style={{ width: 34, height: 34 }} aria-label="Search">
          <Search size={18} />
        </button>
      </div>

      <div className="px-3 pt-0.5 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenUpload();
          }}
          className="flex items-center gap-4 w-full text-left border-none bg-transparent px-2 py-3 rounded-xl cursor-pointer hover:bg-white/5"
        >
          <span className="w-5.5 flex items-center justify-center shrink-0">
            <Plus size={18} />
          </span>
          <span className="text-[17px] text-white">Upload audio or video</span>
        </button>
      </div>

      <div className="h-px bg-white/8 mx-5 my-3.5" />

      <div className="text-[15px] font-semibold text-white/50 px-5 pb-1.5">Recents</div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 capture-scroll-thin">
        {sessions.map((session) => (
          <div key={session.id} className="relative overflow-hidden rounded-[10px] mb-0.5">
            <button
              type="button"
              onClick={() => setPendingDelete(session)}
              aria-label={`Delete ${session.name}`}
              className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[#ff453a] text-white"
            >
              <Trash size={18} />
            </button>
            <motion.div
              drag="x"
              dragConstraints={{ left: -80, right: 0 }}
              dragElastic={0.06}
              dragMomentum={false}
              onDragStart={cancelLongPress}
              animate={
                hintRowId === session.id
                  ? { x: [0, -64, 0] }
                  : { x: swipeOpenId === session.id ? -80 : 0 }
              }
              transition={
                hintRowId === session.id
                  ? { delay: 0.6, duration: 1.15, times: [0, 0.4, 1], ease: [0.32, 0.72, 0, 1] }
                  : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
              }
              onAnimationComplete={() => {
                if (hintRowId === session.id) completeHint();
              }}
              onDragEnd={(_, info) =>
                setSwipeOpenId(info.offset.x < -40 ? session.id : null)
              }
              className="relative bg-[color:var(--sheet-bg)]"
            >
              <button
                type="button"
                onPointerDown={() => beginLongPress(session)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onClick={() => {
                  cancelLongPress();
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  if (swipeOpenId !== null) {
                    setSwipeOpenId(null);
                    return;
                  }
                  handleSelect(session.id);
                }}
                className="w-full text-left px-3 py-3 text-base text-white/85 cursor-pointer truncate hover:bg-white/5"
              >
                {session.name}
                <span className="block text-[13px] text-white/40 font-mono">
                  {formatRecentMeta(session.durationMs, session.createdAt)}
                </span>
              </button>
            </motion.div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-start px-4 py-3.5 border-t border-white/8">
        <button
          type="button"
          onClick={onOpenSettings}
          className={captureGlossyBtn}
          style={{ width: 44, height: 44 }}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-white">Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {pendingDelete ? `"${pendingDelete.name}" will be permanently deleted.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-[#ff453a] text-white hover:bg-[#ff453a]/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
