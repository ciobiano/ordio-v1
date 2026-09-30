'use client';

/**
 * ⌘K — every action in the editor, searchable.
 *
 * Actions are supplied by the shell rather than declared here, so the palette
 * can never drift out of sync with what the rail and top bar actually do.
 */

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DeskSheet } from './DeskSheet';
import { SearchGlyph } from '../DeskIcons';

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  keys?: string;
  run: () => void;
}

interface CommandPaletteProps {
  actions: PaletteAction[];
  onClose: () => void;
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle)
    );
  }, [actions, query]);

  const clamped = Math.min(cursor, Math.max(0, matches.length - 1));

  const run = (action: PaletteAction | undefined) => {
    if (!action) return;
    action.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(matches.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(matches[clamped]);
    }
  };

  return (
    <DeskSheet title="Search actions" onClose={onClose} width="wide" align="top">
      <div className="-m-2 flex flex-col gap-2">
        <div className="flex h-13 items-center gap-2.5 rounded-[14px] bg-[var(--ord-paper)]/5 px-3.5">
          <SearchGlyph size={16} />
          <input
            autoFocus
            type="text"
            value={query}
            aria-label="Search actions"
            placeholder="Search actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-actions"
            aria-activedescendant={matches[clamped] ? `palette-${matches[clamped].id}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            className="h-10 flex-1 border-0 bg-transparent text-[15px] text-[var(--ord-paper)] outline-none placeholder:text-[var(--text-muted)] focus-visible:shadow-none focus-visible:outline-none"
          />
          <span className="flex h-6 items-center rounded-[7px] bg-[var(--ord-paper)]/8 px-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
            ESC
          </span>
        </div>

        <div
          ref={listRef}
          id="palette-actions"
          role="listbox"
          aria-label="Actions"
          className="flex max-h-[46vh] flex-col gap-0.5 overflow-y-auto"
        >
          {matches.length === 0 ? (
            <span className="px-3.5 py-3 text-sm text-[var(--text-muted)]">Nothing matches “{query.trim()}”.</span>
          ) : (
            matches.map((action, i) => (
              <button
                key={action.id}
                id={`palette-${action.id}`}
                type="button"
                role="option"
                aria-selected={i === clamped}
                tabIndex={-1}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(action)}
                className={cn(
                  'flex h-11 flex-none cursor-pointer items-center gap-3 rounded-[12px] border-0 px-3.5 text-left text-sm transition-colors duration-[var(--dur-tap)]',
                  i === clamped ? 'bg-[var(--ord-paper)]/8 text-[var(--ord-paper)]' : 'bg-transparent text-[var(--text-body)]'
                )}
              >
                <span className="flex-1">{action.label}</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
                  {action.keys ?? action.group}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-4 px-1.5 pt-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]" aria-hidden="true">
          <span>↑↓ MOVE</span>
          <span>↵ RUN</span>
        </div>
      </div>
    </DeskSheet>
  );
}
