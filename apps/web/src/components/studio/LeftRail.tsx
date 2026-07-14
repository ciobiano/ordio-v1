'use client';

import { useConvexAuth, usePaginatedQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { formatDuration } from '@/components/saved-audio/formatters';
import { studioRailRow } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
import type { Word } from '@Ordio/shared/schemas';

const PAGE_SIZE = 12;

interface LeftRailProps {
  view: StudioView;
  activeSessionId: string | null;
  onOpenClip: (sessionId: string) => void;
  transcript: Word[];
}

export function LeftRail({ view, activeSessionId, onOpenClip, transcript }: LeftRailProps) {
  const isTranscript = view === 'edit' || view === 'export';

  return (
    <div className="w-70 flex-none bg-acid-bg-subtle border-r border-acid-border-subtle flex flex-col min-h-0 overflow-y-auto">
      {isTranscript ? (
        <TranscriptPane transcript={transcript} />
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
            className={studioRailRow({ active: session.id === activeSessionId })}
            onClick={() => onOpenClip(session.id)}
          >
            <div className="w-11 h-11 rounded-lg bg-acid-surface-2 border border-acid-border-subtle flex-none" />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold text-acid-text-1 truncate">{session.name}</div>
              <div className="text-[11.5px] text-acid-text-3 mt-0.5">{formatDuration(session.durationMs)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TranscriptPane({ transcript }: { transcript: Word[] }) {
  return (
    <>
      <div className="px-4 pt-3.5 pb-2.5 border-b border-acid-border-subtle">
        <div className="font-acid-display font-semibold text-[15px] text-acid-text-1">Transcript</div>
        <div className="text-[11px] text-acid-text-3 mt-0.5">Click a word to cut it</div>
      </div>
      <div className="flex-1 p-4 leading-loose text-[15px]">
        {transcript.map((word, i) => (
          <span key={`${word.text}-${i}`} className="text-acid-text-2 cursor-pointer rounded px-0.5">
            {word.text}{' '}
          </span>
        ))}
      </div>
    </>
  );
}
