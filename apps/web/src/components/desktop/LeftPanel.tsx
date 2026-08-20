'use client';

/**
 * The morphing left column.
 *
 * One surface, two states: `media` (record, upload, saved clips) and
 * `transcript` (the chosen clip's words). Choosing a clip morphs media →
 * transcript; clearing it morphs back. This is a state machine on one column,
 * not two components competing for a slot — which is why the animation is keyed
 * on `mode` and the header is shared.
 */

import { cn } from '@/lib/utils';
import { CollapseButton, CollapsedStrip } from './PanelCollapse';
import type { DeskLine, LeftMode } from '@/lib/desktop/deskState';
import { MediaPane } from './MediaPane';
import { TranscriptPane } from './TranscriptPane';

interface LeftPanelProps {
  mode: LeftMode;
  clipName: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /* media */
  onRecord: () => void;
  onUpload: () => void;
  onOpenSettings: () => void;
  onSelectClip: (sessionId: string, name: string, durationMs: number) => void;
  /* transcript */
  onClearClip: () => void;
  lines: DeskLine[];
  selRow: number;
  cursor: number | null;
  accents: number[];
  t: number;
  findOpen: boolean;
  findText: string;
  replaceWith: string;
  copied: boolean;
  onSelectRow: (row: number) => void;
  onSetCursor: (index: number | null) => void;
  onToggleAccent: (flatIndex: number) => void;
  onToggleFind: () => void;
  onFindText: (value: string) => void;
  onReplaceWith: (value: string) => void;
  onReplaceAll: () => void;
  onAutoHighlight: () => void;
  onSplit: () => void;
  onMerge: (direction: 'up' | 'down') => void;
  onDelete: () => void;
  onCopy: () => void;
  editing: number | null;
  onBeginEdit: (index: number | null) => void;
  onCommitEdit: (index: number, text: string) => void;
}

export function LeftPanel({
  mode,
  clipName,
  collapsed,
  onToggleCollapse,
  ...rest
}: LeftPanelProps) {
  const isTranscript = mode === 'transcript';
  /* The strip names whichever state the column is in, so expanding it holds
     no surprise about what comes back. */
  const title = isTranscript ? 'Transcript' : 'Media';

  if (collapsed) {
    return (
      <aside className="ord-transcript is-collapsed" aria-label={title}>
        <CollapsedStrip side="left" label={title} onExpand={onToggleCollapse} />
      </aside>
    );
  }

  return (
    <aside className="ord-transcript" aria-label={title}>
      <div className="flex flex-none items-center justify-end px-2 pt-2">
        <CollapseButton side="left" label="Hide panel" onClick={onToggleCollapse} />
      </div>

      {isTranscript && clipName && (
        <div className="flex flex-none items-center gap-2 border-b border-[var(--border-hairline)] px-4 py-2">
          <button
            type="button"
            onClick={rest.onClearClip}
            title="Back to your clips"
            className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors duration-[var(--dur-tap)] hover:bg-[var(--ord-paper)]/8 hover:text-[var(--ord-paper)]"
          >
            ←
          </button>
          <span className="min-w-0 flex-1 truncate ord-type-subtitle font-bold text-[var(--ord-paper)]">
            {clipName}
          </span>
        </div>
      )}

      {/* Keyed so the pane genuinely re-enters on morph rather than
          swapping children under a stable node with no transition. */}
      <div
        key={mode}
        className={cn('ord-animate-fade flex min-h-0 flex-1 flex-col')}
      >
        {isTranscript ? (
          <TranscriptPane
            lines={rest.lines}
            selRow={rest.selRow}
            cursor={rest.cursor}
            accents={rest.accents}
            t={rest.t}
            findOpen={rest.findOpen}
            findText={rest.findText}
            replaceWith={rest.replaceWith}
            copied={rest.copied}
            onSelectRow={rest.onSelectRow}
            onSetCursor={rest.onSetCursor}
            onToggleAccent={rest.onToggleAccent}
            onToggleFind={rest.onToggleFind}
            onFindText={rest.onFindText}
            onReplaceWith={rest.onReplaceWith}
            onReplaceAll={rest.onReplaceAll}
            onAutoHighlight={rest.onAutoHighlight}
            onSplit={rest.onSplit}
            onMerge={rest.onMerge}
            onDelete={rest.onDelete}
            onCopy={rest.onCopy}
            editing={rest.editing}
            onBeginEdit={rest.onBeginEdit}
            onCommitEdit={rest.onCommitEdit}
          />
        ) : (
          <MediaPane
            onRecord={rest.onRecord}
            onUpload={rest.onUpload}
            onOpenSettings={rest.onOpenSettings}
            onSelectClip={rest.onSelectClip}
          />
        )}
      </div>
    </aside>
  );
}
