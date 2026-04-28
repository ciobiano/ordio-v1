'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { toast } from 'sonner';
import type { GenericId } from 'convex/values';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  FileAudioIcon,
  MoreHorizontalIcon,
  Search01Icon,
  Sorting05Icon,
  LibraryIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import { api } from '@Ordio/convex';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type SessionSummary = {
  id: GenericId<'sessions'>;
  name: string;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

const SORT_OPTIONS = ['Newest', 'Name', 'Duration'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const PAGE_SIZE = 4;

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatExpiry(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes > 0) return `${minutes}m left`;

  return 'Soon';
}

function formatCreatedAt(createdAt: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(createdAt);
}

export default function SavedAudioPanel() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const renameSession = useMutation(api.sessions.renameSession);
  const deleteSession = useMutation(api.sessions.deleteSession);

  const {
    results: sessions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    isAuthenticated ? {} : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('Newest');
  const [isMobile, setIsMobile] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionSummary | null>(null);
  const [draftName, setDraftName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener?.('change', sync);
    return () => mediaQuery.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!open || status !== 'CanLoadMore') return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore(PAGE_SIZE);
        }
      },
      { rootMargin: '160px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, open, status, sessions.length, query, sort]);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchingSessions = normalizedQuery
      ? sessions.filter((session) => session.name.toLowerCase().includes(normalizedQuery))
      : sessions;

    return [...matchingSessions].sort((left, right) => {
      if (sort === 'Name') return left.name.localeCompare(right.name);
      if (sort === 'Duration') return right.durationMs - left.durationMs;
      return right.createdAt - left.createdAt;
    });
  }, [query, sessions, sort]);

  const loading = authLoading || (isAuthenticated && status === 'LoadingFirstPage');
  const isFetchingMore = status === 'LoadingMore';
  const canLoadMore = status === 'CanLoadMore';
  const sheetSide = isMobile ? 'bottom' : 'right';

  const handleSelect = useCallback(
    (sessionId: GenericId<'sessions'>) => {
      router.push(`/create/export/${sessionId}`);
      setOpen(false);
    },
    [router]
  );

  const openRename = useCallback((session: SessionSummary) => {
    setEditingSession(session);
    setDraftName(session.name);
  }, []);

  const handleRename = useCallback(async () => {
    if (!editingSession) return;

    const nextName = draftName.trim();
    if (!nextName || nextName === editingSession.name) {
      setEditingSession(null);
      return;
    }

    setIsRenaming(true);
    try {
      await renameSession({ sessionId: editingSession.id, title: nextName });
      toast.success('Audio renamed');
      setEditingSession(null);
    } catch {
      toast.error('Failed to rename audio');
    } finally {
      setIsRenaming(false);
    }
  }, [draftName, editingSession, renameSession]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteSession({ sessionId: deleteTarget.id });
      toast.success('Audio deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete audio');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteSession, deleteTarget]);

  if (!authLoading && !isAuthenticated) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              className="mobile-glass-button fixed bottom-5 right-4 z-20 h-14 w-14 rounded-[1.35rem] text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:bg-white/12 active:scale-[0.97] sm:bottom-6 sm:right-6"
              aria-label="Open saved audio"
            />
          }
        >
          <HugeiconsIcon icon={LibraryIcon} size={22} />
        </SheetTrigger>

        <SheetContent
          side={sheetSide}
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none data-[side=bottom]:min-h-[50vh] data-[side=bottom]:max-h-[85vh] sm:h-full sm:w-full sm:max-w-[25rem]"
        >
          <div className="mobile-glass flex h-full w-full flex-col rounded-t-[2rem] sm:rounded-[2rem]">
            {/* Drag handle - centered, per HIG */}
            <div className="mx-auto my-3 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

            {/* Header section - clear hierarchy */}
            <SheetHeader className="gap-4 border-b border-white/10 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-white/85">
                    <HugeiconsIcon icon={FileAudioIcon} size={18} />
                  </div>
                  <SheetTitle className="text-lg font-semibold text-white">
                    Saved audio
                  </SheetTitle>
                </div>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
                      <span className="sr-only">Close</span>
                    </Button>
                  }
                />
              </div>
            </SheetHeader>

            {/* Search section - proper 44pt touch target */}
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/38"
                />
                <Input
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/6 pl-9 text-sm text-white placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Sort section - horizontal scroll, proper spacing */}
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 sm:px-5">
              <span className="shrink-0 text-xs text-white/40">Sort:</span>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {SORT_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSort(option)}
                    className={cn(
                      'h-8 rounded-lg px-3 text-xs font-medium',
                      sort === option
                        ? 'bg-white text-slate-950'
                        : 'text-white/60 hover:bg-white/8 hover:text-white'
                    )}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-5">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="mobile-glass flex items-center gap-3 rounded-[1.35rem] p-3"
                      >
                        <Skeleton variant="circle" size="lg" className="shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton variant="text" size="sm" className="w-3/4" />
                          <Skeleton variant="text" size="xs" className="w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/6 text-white/40">
                      <HugeiconsIcon icon={LibraryIcon} size={20} />
                    </div>
                    <p className="text-sm font-medium text-white">
                      {sessions.length > 0 ? 'No matches found' : 'No saved audio'}
                    </p>
                    <p className="mt-1 max-w-[200px] text-xs text-white/40">
                      {sessions.length > 0
                        ? 'Try a different search term.'
                        : 'Recordings will appear here.'}
                    </p>
                  </div>
                ) : (
                  <ul role="list" className="space-y-2">
                    {filteredSessions.map((session) => {
                      const isExpired = session.expiresAt <= Date.now();

                      return (
                        <li key={session.id}>
                          <div
                            className={cn(
                              'flex items-center gap-3 rounded-xl bg-white/5 p-2.5',
                              !isExpired && 'active:bg-white/8',
                              isExpired && 'pointer-events-none opacity-40'
                            )}
                          >
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-3"
                              onClick={() => handleSelect(session.id)}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
                                <HugeiconsIcon icon={PlayIcon} size={16} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-white">{session.name}</div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                                  <span>{formatDuration(session.durationMs)}</span>
                                  <span className="rounded bg-white/8 px-1.5 py-0.5">
                                    {formatExpiry(session.expiresAt)}
                                  </span>
                                </div>
                              </div>
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
                                    aria-label={`More for ${session.name}`}
                                  />
                                }
                              >
                                <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                side="top"
                                align="end"
                                className="min-w-40 rounded-2xl border border-white/10 bg-slate-950/85 text-white"
                              >
                                <DropdownMenuItem onClick={() => openRename(session)}>
                                  <HugeiconsIcon icon={Edit02Icon} size={16} />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(session)}
                                >
                                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div ref={loadMoreRef} className="h-6" aria-hidden="true" />

                {isFetchingMore && filteredSessions.length > 0 && (
                  <div className="py-3 text-center text-xs text-white/40">
                    Loading more…
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={editingSession !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingSession(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 p-5 text-white"
        >
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Rename saved audio</DialogTitle>
            <DialogDescription className="text-white/55">
              Give this recording a clearer label for faster reuse.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Recording name"
            className="h-12 rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-white/30"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingSession(null)}
              className="rounded-2xl text-white/70 hover:bg-white/8 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRename}
              disabled={isRenaming || draftName.trim().length === 0}
              className="rounded-2xl bg-white text-slate-950 hover:bg-white/90"
            >
              {isRenaming ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent
          className="mobile-glass max-w-[calc(100%-1.5rem)] rounded-[2rem] border border-white/10 bg-slate-950/88 text-white"
        >
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-white">Delete saved audio?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {deleteTarget ? `"${deleteTarget.name}" will be removed from your library.` : 'This audio will be removed from your library.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/6 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-red-500/90 text-white hover:bg-red-500"
            >
              {isDeleting ? 'Deleting…' : 'Delete audio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
