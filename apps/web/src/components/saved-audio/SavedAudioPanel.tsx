'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { toast } from 'sonner';
import type { GenericId } from 'convex/values';
import { HugeiconsIcon } from '@hugeicons/react';
import {
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
const PAGE_SIZE = 12;

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
          className="h-[88vh] border-0 bg-transparent p-0 shadow-none sm:h-full sm:w-full sm:max-w-[25rem]"
        >
          <div className="mobile-glass flex min-h-full w-full flex-col rounded-t-[2rem] sm:rounded-[2rem]">
            <div className="mx-auto my-3 h-[5px] w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

            <SheetHeader className="border-b border-white/10 px-4 pb-4 pt-2 sm:px-5 sm:pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-cyan-50/85">
                    <HugeiconsIcon icon={FileAudioIcon} size={20} />
                  </div>
                  <SheetTitle className="text-xl font-semibold tracking-[-0.03em] text-white">
                    Saved audio
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-sm leading-6 text-white/55">
                    Pick up where you left off. More items load as you scroll.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/38"
                />
                <Input
                  placeholder="Search saved audio"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 rounded-2xl border-white/10 bg-white/6 pl-9 text-white placeholder:text-white/30"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/42">
                  <HugeiconsIcon icon={Sorting05Icon} size={12} />
                  Sort
                </div>
                {SORT_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSort(option)}
                    className={cn(
                      'h-9 rounded-full px-4 text-sm active:scale-[0.98]',
                      sort === option
                        ? 'bg-white text-slate-950 hover:bg-white/90'
                        : 'mobile-glass-button text-white/72 hover:bg-white/10'
                    )}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
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
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="mobile-glass-button mb-4 flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-white/60">
                      <HugeiconsIcon icon={LibraryIcon} size={24} />
                    </div>
                    <p className="text-base font-medium text-white">
                      {sessions.length > 0 ? 'No matches found' : 'No saved audio yet'}
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/48">
                      {sessions.length > 0
                        ? 'Try a different name or sort option.'
                        : 'Your recordings and uploads will appear here for quick reopen.'}
                    </p>
                  </div>
                ) : (
                  <ul role="list" className="space-y-3">
                    {filteredSessions.map((session) => {
                      const isExpired = session.expiresAt <= Date.now();

                      return (
                        <li key={session.id}>
                          <div
                            className={cn(
                              'mobile-glass group flex items-center gap-3 rounded-[1.5rem] p-3 transition-transform duration-200',
                              !isExpired && 'active:scale-[0.985]',
                              isExpired && 'pointer-events-none opacity-45'
                            )}
                          >
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              onClick={() => handleSelect(session.id)}
                            >
                              <div className="mobile-glass-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white/82">
                                <HugeiconsIcon icon={PlayIcon} size={18} />
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">{session.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/46">
                                  <span>{formatDuration(session.durationMs)}</span>
                                  <span className="rounded-full bg-white/8 px-2 py-1">
                                    {formatExpiry(session.expiresAt)}
                                  </span>
                                  <span>{formatCreatedAt(session.createdAt)}</span>
                                </div>
                              </div>
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-2xl text-white/70 hover:bg-white/10 hover:text-white"
                                    aria-label={`More actions for ${session.name}`}
                                  />
                                }
                              >
                                <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
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

                {(isFetchingMore || canLoadMore) && filteredSessions.length > 0 && (
                  <div className="pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => loadMore(PAGE_SIZE)}
                      disabled={!canLoadMore}
                      className="mobile-glass-button h-11 w-full rounded-2xl text-white/78 hover:bg-white/10"
                    >
                      {isFetchingMore ? 'Loading more…' : 'Load more'}
                    </Button>
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
