'use client';

import { studioButton } from '@/lib/studioVariants';

interface TopBarProps {
  title: string;
  onExport: () => void;
}

export function TopBar({ title, onExport }: TopBarProps) {
  return (
    <div className="h-15 flex-none flex items-center gap-4 px-4.5 bg-acid-bg-subtle border-b border-acid-border-subtle">
      <div className="flex items-center gap-3.5 w-65">
        <div className="w-7.5 h-7.5 rounded-lg bg-acid-text-1 text-acid-bg-base flex items-center justify-center font-acid-display font-bold text-lg flex-none">
          O
        </div>
        <div className="flex flex-col min-w-0">
          <div className="font-acid-display font-semibold text-base text-acid-text-1 truncate">
            {title}
          </div>
          <div className="text-xs text-acid-text-3">ordio / voice clips</div>
        </div>
      </div>
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2.5 h-8.5 px-3 bg-acid-surface-1 border border-acid-border-subtle rounded-acid-sm text-acid-text-3 text-sm min-w-75">
          Search actions, ask copilot…
          <span className="ml-auto flex gap-0.5">
            <kbd className="bg-acid-surface-2 border border-acid-border-subtle rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              ⌘
            </kbd>
            <kbd className="bg-acid-surface-2 border border-acid-border-subtle rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              K
            </kbd>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className={studioButton({ variant: 'primary' })} onClick={onExport}>
          Export ↗
        </button>
        <div className="w-8.5 h-8.5 rounded-full bg-acid-surface-2 border border-acid-border-default flex items-center justify-center text-sm font-bold text-acid-text-1">
          MK
        </div>
      </div>
    </div>
  );
}
