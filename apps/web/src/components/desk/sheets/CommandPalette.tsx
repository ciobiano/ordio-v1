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
      <input
        autoFocus
        type="text"
        value={query}
        placeholder="Search actions"
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={onKeyDown}
        className="ord-type-label h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--ord-paper)]/6 px-3 text-[var(--ord-paper)] outline-none focus-visible:border-[var(--ord-acid)]"
      />

      <div ref={listRef} className="flex max-h-[46vh] flex-col gap-1 overflow-y-auto">
        {matches.length === 0 ? (
          <span className="ord-type-footnote px-1 py-3 text-[var(--text-muted)]">
            Nothing matches “{query.trim()}”.
          </span>
        ) : (
          matches.map((action, i) => (
            <button
              key={action.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => run(action)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-[var(--dur-tap)]',
                i === clamped
                  ? 'bg-[var(--ord-acid)]/12'
                  : 'bg-transparent hover:bg-[var(--ord-paper)]/5'
              )}
            >
              <span className="ord-type-micro w-[68px] flex-none text-[var(--text-muted)] uppercase">
                {action.group}
              </span>
              <span className="ord-type-footnote flex-1 text-[var(--ord-paper)]">
                {action.label}
              </span>
              {action.keys && <span className="ord-kbd flex-none">{action.keys}</span>}
            </button>
          ))
        )}
      </div>
    </DeskSheet>
  );
}
