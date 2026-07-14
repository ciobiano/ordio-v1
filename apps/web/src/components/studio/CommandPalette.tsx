'use client';

import { useMemo, useState } from 'react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  onGoLibrary: () => void;
}

interface Action {
  id: string;
  label: string;
  run: () => void;
}

export function CommandPalette({ open, onClose, onExport, onGoLibrary }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  // Only real, wired actions live here — no placeholder commands that do
  // nothing when clicked. Trim/style/copilot actions land once the action
  // registry (design spec Slice 3) exists.
  const actions: Action[] = useMemo(
    () => [
      { id: 'export', label: 'Export all formats', run: onExport },
      { id: 'library', label: 'Go to Library', run: onGoLibrary },
    ],
    [onExport, onGoLibrary]
  );

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  const runAndClose = (action: Action) => {
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search actions…"
            className="flex-1 bg-transparent outline-none text-acid-text-1 text-base"
          />
          <span className="text-[11px] text-acid-text-3">esc</span>
        </div>
        <div className="overflow-y-auto p-2">
          {filtered.map((action) => (
            <div
              key={action.id}
              onClick={() => runAndClose(action)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-acid-sm cursor-pointer hover:bg-acid-surface-2 text-sm text-acid-text-1"
            >
              {action.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
