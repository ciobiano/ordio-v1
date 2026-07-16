'use client';

import { useCallback, useState } from 'react';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { toast } from 'sonner';
import { Trash } from 'griddy-icons';
import { api } from '@Ordio/convex';
import CaptionEditor from '@/components/soul/captions/CaptionEditor';
import { formatDuration } from '@/components/saved-audio/formatters';
import { studioRailRow } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
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

const PAGE_SIZE = 12;

interface LeftRailProps {
  view: StudioView;
  activeSessionId: string | null;
  onOpenClip: (sessionId: string) => void;
  onGoIdle: () => void;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function LeftRail({ view, activeSessionId, onOpenClip, onGoIdle, currentTime, onSeek }: LeftRailProps) {
  const isTranscript = view === 'edit' || view === 'export';

  return (
    <div className="w-70 flex-none bg-acid-bg-subtle border-r border-acid-border-subtle flex flex-col min-h-0 overflow-y-auto">
      {isTranscript ? (
        <TranscriptPane onGoIdle={onGoIdle} currentTime={currentTime} onSeek={onSeek} />
      ) : (
        <LibraryPane activeSessionId={activeSessionId} onOpenClip={onOpenClip} />
      )}
    </div>
  );
}

function LibraryPane({
  activeSessionId,
  onOpenClip,
}: {
  activeSessionId: string | null;
  onOpenClip: (sessionId: string) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { results: sessions } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    isAuthenticated ? {} : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const deleteSession = useMutation(api.sessions.deleteSession);
  const [pendingDelete, setPendingDelete] = useState<(typeof sessions)[number] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSession({ sessionId: pendingDelete.id });
      toast.success('Recording deleted');
    } catch {
      toast.error('Failed to delete recording');
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }, [deleteSession, pendingDelete]);

  return (
    <>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="font-acid-display font-semibold text-[15px] text-acid-text-1">Library</div>
        <div className="text-[11px] text-acid-text-3 bg-acid-surface-1 border border-acid-border-subtle px-2 py-0.5 rounded">
          {sessions.length} clips
        </div>
      </div>
      <div className="flex-1 px-2.5 pb-3 flex flex-col gap-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={studioRailRow({ active: session.id === activeSessionId }) + ' group'}
            onClick={() => onOpenClip(session.id)}
          >
            <div className="w-11 h-11 rounded-lg bg-acid-surface-2 border border-acid-border-subtle flex-none" />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold text-acid-text-1 truncate">{session.name}</div>
              <div className="text-[11.5px] text-acid-text-3 mt-0.5">{formatDuration(session.durationMs)}</div>
            </div>
            <button
              type="button"
              aria-label={`Delete ${session.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(session);
              }}
              className="flex-none w-7 h-7 rounded-md flex items-center justify-center text-acid-text-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-acid-error hover:bg-acid-surface-2 transition-opacity"
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="bg-acid-surface-1 border border-acid-border-default text-acid-text-1">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-acid-text-1">Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription className="text-acid-text-2">
              {pendingDelete ? `"${pendingDelete.name}" will be permanently deleted.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-acid-surface-2 border-acid-border-default text-acid-text-1 hover:bg-acid-surface-3">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-acid-error text-white hover:bg-acid-error/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TranscriptPane({
  onGoIdle,
  currentTime,
  onSeek,
}: {
  onGoIdle: () => void;
  currentTime: number;
  onSeek: (time: number) => void;
}) {
  return (
    <>
      <div className="px-4 pt-3.5 pb-2.5 border-b border-acid-border-subtle">
        <button
          onClick={onGoIdle}
          className="text-xs text-acid-text-2 hover:text-acid-text-1 flex items-center gap-1.5 mb-2"
        >
          ‹ Library
        </button>
        <div className="font-acid-display font-semibold text-[15px] text-acid-text-1">Transcript</div>
        <div className="text-[11px] text-acid-text-3 mt-0.5">Select a caption to split or merge</div>
      </div>
      <div className="flex-1 min-h-0 px-3 pt-3 pb-4">
        <CaptionEditor currentTime={currentTime} onSeek={onSeek} />
      </div>
    </>
  );
}
