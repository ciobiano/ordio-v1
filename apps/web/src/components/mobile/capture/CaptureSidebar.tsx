'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { useUser, useClerk } from '@clerk/nextjs';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, PlusSignIcon, Settings01Icon } from '@hugeicons/core-free-icons';
import { api } from '@Ordio/convex';
import { captureGlossyBtn, sheetButton } from '@/lib/variants';
import { formatDuration } from '@/components/saved-audio/formatters';
import { RecordingRow } from './RecordingRow';
import { useSwipeHint } from './useSwipeHint';
import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet';
import { DangerBadge } from '@/components/ui/SheetGlyphs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

const PAGE_SIZE = 8;

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
  onClose: () => void;
}

export function CaptureSidebar({ onOpenUpload, onClose }: CaptureSidebarProps) {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const displayName = user?.firstName ?? user?.username ?? 'Account';
  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';

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

  const { hintRowId, onHintPlayed, onUserSwiped } = useSwipeHint(sessions[0]?.id);

  const renameSession = useMutation(api.sessions.renameSession);
  // Id, not string: RecordingRow is presentational and knows ids only as
  // strings, but the mutation is typed against the table. Taking the branded id
  // here keeps the cast out of the component and the call site type-checked.
  const handleRename = useCallback(
    async (sessionId: (typeof sessions)[number]['id'], title: string) => {
      try {
        await renameSession({ sessionId, title });
      } catch {
        // The row has already dropped back to its label by now, and Convex is
        // the source of truth for it — so a failure just means the old name
        // stays put, and the toast is what explains why.
        toast.error('Could not rename this recording');
      }
    },
    [renameSession]
  );

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
          <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={2} />
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
            <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
          </span>
          <span className="text-[17px] text-white">Upload audio or video</span>
        </button>
      </div>

      <div className="h-px bg-white/8 mx-5 my-3.5" />

      <div className="text-[15px] font-semibold text-white/50 px-5 pb-1.5">Recents</div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {sessions.map((session) => (
          <RecordingRow
            key={session.id}
            session={session}
            meta={formatRecentMeta(session.durationMs, session.createdAt)}
            isSwipeOpen={swipeOpenId === session.id}
            onSwipeOpenChange={(open) => setSwipeOpenId(open ? session.id : null)}
            isHinting={hintRowId === session.id}
            onHintPlayed={onHintPlayed}
            onUserSwiped={onUserSwiped}
            onSelect={() => handleSelect(session.id)}
            onRequestDelete={() => setPendingDelete(session)}
            onRename={(title) => handleRename(session.id, title)}
          />
        ))}
      </div>

      <div className="flex items-center justify-start px-4 py-3.5 border-t border-white/8">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={captureGlossyBtn}
            style={{ width: 44, height: 44 }}
            aria-label="Account options"
          >
            <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={2} />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="top" className="w-56 p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
                  {email && <span className="text-xs text-muted-foreground truncate">{email}</span>}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => openUserProfile()} className="cursor-pointer">
                Manage account
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => signOut()} variant="destructive" className="cursor-pointer">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OrdSheet
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
        dismissible={!isDeleting}
        role="alertdialog"
        title="Delete this recording?"
        description={pendingDelete ? `"${pendingDelete.name}" will be permanently deleted.` : undefined}
        icon={<DangerBadge kind="bin" />}
        footer={
          <OrdSheetActions>
            <button
              type="button"
              className={sheetButton({ tone: 'secondary' })}
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={sheetButton({ tone: 'danger' })}
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </OrdSheetActions>
        }
      />
    </div>
  );
}
