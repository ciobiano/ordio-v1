'use client';

import { useEffect, useState } from 'react';

export interface PaletteAction {
  id: string;
  label: string;
  icon?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}

export function CommandPalette({ open, onClose, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  // Fresh query + selection every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
    }
  }, [open]);

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));
  const clampedHighlight = Math.min(highlighted, Math.max(0, filtered.length - 1));

  if (!open) return null;

  const runAndClose = (action: PaletteAction) => {
    action.run();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 bg-acid-bg-base/70 backdrop-blur-sm flex justify-center pt-30"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-140 h-max max-h-110 bg-acid-surface-1 border border-acid-border-default rounded-acid-lg shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center gap-3 px-4.5 py-4 border-b border-acid-border-subtle">
          <span className="text-acid-text-1 text-lg">✦</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlighted((h) => Math.max(h - 1, 0));
              }
              if (e.key === 'Enter' && filtered[clampedHighlight]) {
                runAndClose(filtered[clampedHighlight]);
              }
            }}
            placeholder="record, drop, or ask anything…"
            className="flex-1 bg-transparent outline-none text-acid-text-1 text-base"
          />
          <span className="text-[11px] text-acid-text-3">esc</span>
        </div>
        <div className="overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-sm text-acid-text-3">No matching actions.</div>
          )}
          {filtered.map((action, i) => (
            <div
              key={action.id}
              onClick={() => runAndClose(action)}
              onMouseEnter={() => setHighlighted(i)}
              className={
                'flex items-center gap-3 px-3 py-2.5 rounded-acid-sm cursor-pointer text-sm text-acid-text-1 ' +
                (i === clampedHighlight ? 'bg-acid-surface-2' : '')
              }
            >
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-lg bg-acid-surface-2 border border-acid-border-subtle flex items-center justify-center text-[13px] text-acid-text-2 flex-none"
              >
                {action.icon ?? '·'}
              </span>
              {action.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
