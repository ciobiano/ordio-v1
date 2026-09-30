'use client';

/** Every key the editor listens for. Read-only. */

import { DeskSheet, DeskSheetHeader } from './DeskSheet';

const SHORTCUTS = [
  { what: 'Play or pause', keys: 'space' },
  { what: 'Nudge the playhead', keys: '← →' },
  { what: 'Jump a second', keys: '⇧ ← →' },
  { what: 'Jump word to word', keys: '⌥ ← →' },
  { what: 'Split at the cursor', keys: 'S' },
  { what: 'Find and replace', keys: '⌘F' },
  { what: 'Undo · redo', keys: '⌘Z · ⇧⌘Z' },
  { what: 'Hide or show the left panel', keys: '[' },
  { what: 'Hide or show the inspector', keys: ']' },
  { what: 'Search actions', keys: '⌘K' },
  { what: 'Export', keys: '⌘E' },
];

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <DeskSheet title="Keyboard shortcuts" onClose={onClose} width="split">
      <DeskSheetHeader title="Keyboard shortcuts" onClose={onClose} />

      <dl className="m-0 grid grid-cols-2 gap-x-6 overflow-y-auto">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.what}
            className="flex h-11 items-center justify-between gap-4 border-b border-[var(--ord-paper)]/6"
          >
            <dt className="text-sm text-[var(--text-body)]">{shortcut.what}</dt>
            <dd className="m-0 flex h-6.5 min-w-6.5 flex-none items-center justify-center rounded-[7px] bg-[var(--ord-paper)]/8 px-2 font-[family-name:var(--font-mono)] text-xs text-[var(--ord-paper)] shadow-[inset_0_-1px_0_rgb(0_0_0/0.4)]">
              {shortcut.keys}
            </dd>
          </div>
        ))}
      </dl>
    </DeskSheet>
  );
}
