'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, usePaginatedQuery } from 'convex/react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  FileAudioIcon,
  MoreHorizontalIcon,
  Search01Icon,
  LibraryIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import { api } from '@Ordio/convex';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SavedAudioDialogs } from './SavedAudioDialogs';
import { formatDuration, formatExpiry } from './formatters';
import { SORT_OPTIONS, type SessionSummary, type SortOption } from './types';
const PAGE_SIZE = 4;

interface SavedAudioPanelProps {
  /** Controlled open state — pass when an external trigger (e.g. CaptureHeader) owns this drawer. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in floating action button trigger; use when a controlled open is provided. */
  hideTrigger?: boolean;
}

export default function SavedAudioPanel({ open, onOpenChange, hideTrigger }: SavedAudioPanelProps = {}) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { user } = useUser();
  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <SavedAudioPanelBody
      key={`${user?.id ?? 'saved-audio-anonymous'}:${isAuthenticated ? 'auth' : 'anon'}`}
      open={open}
      onOpenChange={onOpenChange}
      hideTrigger={hideTrigger}
    />
  );
}

function SavedAudioPanelBody({ open: controlledOpen, onOpenChange, hideTrigger }: SavedAudioPanelProps) {
  const router = useRouter();
  const renameSession = useMutation(api.sessions.renameSession);
  const deleteSession = useMutation(api.sessions.deleteSession);

  const {
    results: sessions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('Newest');
  const [editingSession, setEditingSession] = useState<SessionSummary | null>(null);
  const [draftName, setDraftName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadInFlightRef = useRef(false);
  const previousStatusRef = useRef(status);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const requestMoreIfNeeded = useCallback(() => {
    const container = scrollRootRef.current;
    if (!container || !open || status !== 'CanLoadMore' || loadInFlightRef.current) return;

    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldPrefetch = container.scrollHeight <= container.clientHeight + 24;
    if (remaining > 180 && !shouldPrefetch) return;

    loadInFlightRef.current = true;
    loadMore(PAGE_SIZE);
  }, [loadMore, open, sessions.length, status]);

  useEffect(() => {
    if (previousStatusRef.current === 'LoadingMore' && status !== 'LoadingMore') {
      loadInFlightRef.current = false;
    }
    previousStatusRef.current = status;
  }, [sessions.length, status]);

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

  const loading = status === 'LoadingFirstPage';
  const isFetchingMore = status === 'LoadingMore';
  const canLoadMore = status === 'CanLoadMore';

  useEffect(() => {
    if (!open) return;
    triggerRef.current?.blur();
    const rafId = requestAnimationFrame(requestMoreIfNeeded);
    return () => cancelAnimationFrame(rafId);
  }, [open, sessions.length, filteredSessions.length, requestMoreIfNeeded]);

  const handleSelect = useCallback(
    (sessionId: SessionSummary['id']) => {
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

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen} preventScrollRestoration={false}>
        {!hideTrigger && (
          <DrawerTrigger asChild>
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon-lg"
              className="mobile-glass-button fixed bottom-5 right-4 z-20 h-14 w-14 rounded-[1.35rem] text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:bg-white/12 active:scale-[0.97] sm:bottom-6 sm:right-6"
              aria-label="Open saved audio"
            >
              <HugeiconsIcon icon={LibraryIcon} size={22} />
            </Button>
          </DrawerTrigger>
        )}

        <DrawerContent
          className="flex min-h-0 flex-col bg-[color:var(--glass-bg)] border-t border-white/[0.08] p-0 backdrop-blur-xl max-h-[85vh] sm:h-full sm:max-w-[25rem] sm:rounded-[2rem]"
        >
          <DrawerTitle className="sr-only">Saved Audio</DrawerTitle>
          <DrawerDescription className="sr-only">
            Browse, search, rename, and reopen your saved audio recordings.
          </DrawerDescription>
          
          <div className="sticky top-0 z-10 shrink-0 bg-[color:var(--glass-bg)]/95 backdrop-blur-xl">
            <div className="mx-auto my-3 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-white/85">
                  <HugeiconsIcon icon={FileAudioIcon} size={18} />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Saved audio
                </h2>
              </div>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            </div>

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

            <div className="border-b border-white/10 px-4 py-2 sm:px-5">
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
          </div>

          <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onScroll={requestMoreIfNeeded}>
            <div className="p-4 sm:p-5">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="mobile-glass flex items-center gap-3 rounded-[1.35rem] p-3"
                      >
                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-white/10" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-white/8" />
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
                {isFetchingMore && filteredSessions.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span className="text-xs text-white/50">Loading more…</span>
                  </div>
                )}

                {!isFetchingMore && !canLoadMore && filteredSessions.length > 0 && (
                  <div className="pt-3 pb-1 text-center text-[11px] text-white/35">
                    You&apos;ve reached the end of saved audio.
                  </div>
                )}
              </div>
          </div>
        </DrawerContent>
      </Drawer>
      <SavedAudioDialogs
        editingSession={editingSession}
        draftName={draftName}
        setDraftName={setDraftName}
        isRenaming={isRenaming}
        onRename={handleRename}
        onCloseRename={() => setEditingSession(null)}
        deleteTarget={deleteTarget}
        isDeleting={isDeleting}
        onDelete={handleDelete}
        onCloseDelete={() => setDeleteTarget(null)}
      />
    </>
  );
}
