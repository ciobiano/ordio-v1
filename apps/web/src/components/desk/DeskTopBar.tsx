'use client';

/**
 * Top bar: identity, ⌘K search, history, export.
 *
 * The design's "Creator preview" toggle is gone with the rest of the tier —
 * there is nothing left for it to preview.
 */

import { cn } from '@/lib/utils';
import { Logo } from '@/components/primitives/Logo';
import { iconButton, solidButton } from '@/lib/desk/deskVariants';
import {
  KeyboardGlyph,
  RedoGlyph,
  SearchGlyph,
  UndoGlyph,
} from './DeskIcons';

interface DeskTopBarProps {
  sourceLine: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  onSearch: () => void;
  onShortcuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export function DeskTopBar({
  sourceLine,
  canUndo,
  canRedo,
  canExport,
  onSearch,
  onShortcuts,
  onUndo,
  onRedo,
  onExport,
}: DeskTopBarProps) {
  return (
    <header className="ord-topbar">
      {/* The one Ordio mark. Logo.tsx exists precisely so a new surface does
          not invent its own stand-in — its docstring names the last one that
          did (a rounded square holding an "O"), which is exactly what sat here
          before. The wordmark is part of the lockup, so the only thing left to
          stack is the source line. */}
      <div className="flex flex-none items-center gap-3">
        <Logo size="sm" />
        <span className="ord-mono">{sourceLine}</span>
      </div>

      <div className="flex flex-1 justify-center">
        <button type="button" onClick={onSearch} className="ord-searchbar">
          <SearchGlyph size={14} />
          <span className="flex-1 text-left font-[family-name:var(--font-display)] ord-type-caption">
            Search actions
          </span>
          <span className="ord-kbd">⌘K</span>
        </button>
      </div>

      <div className="flex flex-none items-center gap-2.5">
        <button
          type="button"
          onClick={onShortcuts}
          title="Keyboard shortcuts"
          className={iconButton({ tone: 'outline' })}
        >
          <KeyboardGlyph size={16} />
        </button>

        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo · ⌘Z"
            className={iconButton({ tone: 'bare' })}
          >
            <UndoGlyph size={17} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo · ⇧⌘Z"
            className={iconButton({ tone: 'bare' })}
          >
            <RedoGlyph size={17} />
          </button>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className={cn(solidButton({ tone: 'acid' }), 'disabled:opacity-40')}
        >
          Export
          <span className="font-[family-name:var(--font-mono)] ord-type-micro opacity-60">
            ⌘E
          </span>
        </button>
      </div>
    </header>
  );
}
