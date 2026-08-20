'use client';

/**
 * Media — the left column's opening state.
 *
 * In the design this was an inspector tool, which left the left column empty
 * until a clip existed. Here it *is* the left column, and choosing a clip
 * morphs the same surface into the transcript.
 */

import { useConvexAuth, usePaginatedQuery } from 'convex/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Settings01Icon } from '@hugeicons/core-free-icons';
import { api } from '@Ordio/convex';
import { formatDuration } from '@/components/saved-audio/formatters';
import { iconButton, listRow } from '@/lib/variants';
import { ClipGlyph, MicGlyph, UploadGlyph } from './DeskIcons';

const PAGE_SIZE = 20;

interface MediaPaneProps {
  onRecord: () => void;
  onUpload: () => void;
  onOpenSettings: () => void;
  onSelectClip: (sessionId: string, name: string, durationMs: number) => void;
}

export function MediaPane({
  onRecord,
  onUpload,
  onOpenSettings,
  onSelectClip,
}: MediaPaneProps) {
  const { isAuthenticated } = useConvexAuth();
  const { results: sessions, status } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    isAuthenticated ? {} : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const actions = [
    {
      id: 'record',
      label: 'Record',
      hint: 'Straight into the browser, no setup',
      Glyph: MicGlyph,
      on: onRecord,
    },
    {
      id: 'upload',
      label: 'Upload',
      hint: 'Audio or video — we pull the sound out',
      Glyph: UploadGlyph,
      on: onUpload,
    },
  ];

  return (
    <div
      data-scroll
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4"
    >
      <section className="flex flex-col gap-2">
        {/* Audio settings sit with the actions they affect. They govern the
            microphone and enhancement, so a playback transport was never
            their home. */}
        <span className="flex items-center justify-between gap-2">
          <span className="ord-eyebrow">Bring in audio</span>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Audio settings"
            aria-label="Audio settings"
            className={iconButton({ tone: 'bare', size: 'sm' })}
          >
            <HugeiconsIcon icon={Settings01Icon} size={14} strokeWidth={2} />
          </button>
        </span>
        {actions.map(({ id, label, hint, Glyph, on }) => (
          <button
            key={id}
            type="button"
            onClick={on}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-[var(--ord-paper)]/5 p-3 text-left transition-colors duration-[var(--dur-tap)] hover:border-[var(--border-hairline)]"
          >
            <span className="flex size-[34px] flex-none items-center justify-center rounded-xl bg-[var(--ord-paper)]/8 text-[var(--ord-paper)]">
              <Glyph size={17} />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="ord-type-label font-semibold text-[var(--ord-paper)]">
                {label}
              </span>
              <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.35] text-[var(--text-muted)]">
                {hint}
              </span>
            </span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <span className="ord-eyebrow">Your clips</span>

        {status === 'LoadingFirstPage' ? (
          <span className="ord-mono px-1">Loading…</span>
        ) : sessions.length === 0 ? (
          <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.4] text-[var(--text-muted)]">
            Nothing saved yet. Record something and it lands here.
          </span>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectClip(session.id, session.name, session.durationMs)}
              className={listRow({ selected: false }) + ' items-center'}
            >
              <span className="flex size-[30px] flex-none items-center justify-center rounded-xl bg-[var(--ord-paper)]/8 text-[var(--text-body)]">
                <ClipGlyph size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-display)] ord-type-caption text-[var(--ord-paper)]">
                {session.name}
              </span>
              <span className="ord-mono flex-none">
                {formatDuration(session.durationMs)}
              </span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
