'use client';

/** Every key the editor listens for. Read-only. */

import { DeskSheet } from './DeskSheet';

const SHORTCUTS = [
  { what: 'Play or pause', keys: 'space' },
  { what: 'Nudge the playhead', keys: '← →' },
  { what: 'Jump a second', keys: '⇧ ← →' },
  { what: 'Jump word to word', keys: '⌥ ← →' },
  { what: 'Split at the cursor', keys: 'S' },
  { what: 'Find and replace', keys: '⌘F' },
  { what: 'Undo · redo', keys: '⌘Z · ⇧⌘Z' },
  { what: 'Search actions', keys: '⌘K' },
  { what: 'Export', keys: '⌘E' },
];

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <DeskSheet title="Keyboard shortcuts" onClose={onClose}>
      <span className="ord-type-label font-bold text-[var(--ord-paper)]">
        Keyboard shortcuts
      </span>

      <ul className="flex list-none flex-col gap-0.5 overflow-y-auto p-0">
        {SHORTCUTS.map((shortcut) => (
          <li
            key={shortcut.what}
            className="flex items-center justify-between gap-4 border-b border-[var(--border-hairline)] py-2 last:border-b-0"
          >
            <span className="ord-type-footnote text-[var(--text-body)]">
              {shortcut.what}
            </span>
            <span className="ord-kbd flex-none text-[var(--ord-paper)]">
              {shortcut.keys}
            </span>
          </li>
        ))}
      </ul>
    </DeskSheet>
  );
}
