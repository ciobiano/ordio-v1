'use client';

import { useRouter } from 'next/navigation';
import { useConvexAuth, usePaginatedQuery } from 'convex/react';
import { Search, Folders, Menu, Plus, Settings } from 'griddy-icons';
import { api } from '@Ordio/convex';
import { captureGlossyBtn } from '@/lib/variants';
import { formatDuration } from '@/components/saved-audio/formatters';

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-5.5 pb-4">
        <span className="text-2xl font-bold text-white">Recordings</span>
        <button type="button" className={captureGlossyBtn} style={{ width: 34, height: 34 }} aria-label="Search">
          <Search size={18} />
        </button>
      </div>

      <div className="px-3 pt-0.5 flex flex-col gap-0.5">
        <button type="button" className="flex items-center gap-4 w-full text-left border-none bg-transparent px-2 py-3 rounded-xl cursor-pointer hover:bg-white/5">
          <span className="w-5.5 flex items-center justify-center shrink-0">
            <Folders size={18} />
          </span>
          <span className="text-[17px] text-white">Library</span>
        </button>
        <button type="button" className="flex items-center gap-4 w-full text-left border-none bg-transparent px-2 py-3 rounded-xl cursor-pointer hover:bg-white/5">
          <span className="w-5.5 flex items-center justify-center shrink-0">
            <Menu size={18} />
          </span>
          <span className="text-[17px] text-white">All recordings</span>
        </button>
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
          <button
            key={session.id}
            type="button"
            onClick={() => handleSelect(session.id)}
            className="w-full text-left px-3 py-3 text-base text-white/85 rounded-[10px] cursor-pointer truncate hover:bg-white/5"
          >
            {session.name}
            <span className="block text-[13px] text-white/40 font-mono">
              {formatRecentMeta(session.durationMs, session.createdAt)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end px-4 py-3.5 border-t border-white/8">
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
    </div>
  );
}
