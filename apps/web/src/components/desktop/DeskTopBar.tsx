'use client';

/**
 * Top bar: where you are, what shape the video is, history, account, Export.
 *
 * Left is the lockup and a breadcrumb — your clips, then the one open. The
 * centre is the aspect ratio, because it is the one choice that changes the
 * whole canvas and the one people reach for first; it used to live two
 * clicks deep in the Reframe tool. Right is history, account and Export, the
 * single lime commit in the window.
 *
 * Search actions (⌘K) stays one click away as a round button; the full-width
 * search field it replaces spent a third of the bar on a shortcut most people
 * trigger from the keyboard.
 */

import { Logo } from '@/components/media/Logo';
import UserAvatarButton from '@/components/mobile/auth/UserAvatarButton';
import { cn } from '@/lib/utils';
import { FORMATS, type FormatId } from '@/lib/desktop/deskCatalog';
import { RedoGlyph, SearchGlyph, UndoGlyph } from './DeskIcons';

interface DeskTopBarProps {
  clipName: string | null;
  format: FormatId;
  /** The ratio control only means something once there is a clip to frame. */
  canReframe: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  onFormat: (format: FormatId) => void;
  onClips: () => void;
  onSearch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

const roundBtn =
  'flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border-0 ' +
  'bg-[var(--ord-paper)]/7 text-[var(--ord-paper)] transition-colors duration-[var(--dur-tap)] ' +
  'enabled:hover:bg-[var(--ord-paper)]/12 disabled:cursor-default disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]';

export function DeskTopBar({
  clipName,
  format,
  canReframe,
  canUndo,
  canRedo,
  canExport,
  onFormat,
  onClips,
  onSearch,
  onUndo,
  onRedo,
  onExport,
}: DeskTopBarProps) {
  return (
    <header className="ord-topbar">
      <div className="flex min-w-0 flex-1 items-center gap-4.5">
        {/* The one Ordio mark — Logo.tsx exists so no surface invents its own. */}
        <Logo size="sm" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          {clipName ? (
            <>
              <button
                type="button"
                onClick={onClips}
                className="cursor-pointer border-0 bg-transparent p-0 text-[var(--text-muted)] transition-colors duration-[var(--dur-tap)] hover:text-[var(--ord-paper)]"
              >
                Clips
              </button>
              <span className="text-[var(--ord-paper)]/30" aria-hidden="true">
                /
              </span>
              <span aria-current="page" className="min-w-0 truncate font-medium text-[var(--ord-paper)]">
                {clipName}
              </span>
            </>
          ) : (
            <span aria-current="page" className="text-[var(--text-muted)]">
              Clips
            </span>
          )}
        </nav>
      </div>

      {canReframe && (
        <div
          role="radiogroup"
          aria-label="Aspect ratio"
          className="flex h-10 flex-none gap-1 rounded-[14px] bg-[var(--ord-paper)]/6 p-1"
        >
          {FORMATS.map((f) => {
            const on = f.id === format;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onFormat(f.id)}
                className={cn(
                  'w-14.5 cursor-pointer rounded-[10px] border-0 font-[family-name:var(--font-mono)] text-xs transition-colors duration-[var(--dur-tap)]',
                  on
                    ? 'bg-[var(--ord-paper)] font-medium text-[var(--ord-ink)]'
                    : 'bg-transparent text-[var(--text-body)] hover:text-[var(--ord-paper)]'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 items-center justify-end gap-2">
        <button type="button" onClick={onSearch} aria-label="Search actions" title="Search actions · ⌘K" className={roundBtn}>
          <SearchGlyph size={15} />
        </button>
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo · ⌘Z" className={roundBtn}>
          <UndoGlyph size={16} />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo · ⇧⌘Z" className={roundBtn}>
          <RedoGlyph size={16} />
        </button>

        {/* Account: avatar picker, Manage Account, Sign Out. */}
        <span className="ml-1 flex items-center">
          <UserAvatarButton size="sm" />
        </span>

        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          title="Export · ⌘E"
          className={cn(
            'ml-2 flex h-10 flex-none cursor-pointer items-center gap-2 rounded-[14px] border-0 px-4.5 text-sm font-semibold',
            'bg-[var(--ord-acid)] text-[var(--ord-on-acid)] shadow-[0_3px_0_var(--acid-accent-lip)]',
            'transition-[transform,box-shadow] duration-[var(--dur-tap)] enabled:active:translate-y-0.75 enabled:active:shadow-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ord-ink)]',
            'disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
          )}
        >
          Export
        </button>
      </div>
    </header>
  );
}
