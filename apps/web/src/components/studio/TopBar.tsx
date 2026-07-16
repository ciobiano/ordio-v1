'use client';

import Link from 'next/link';
import UserAvatarButton from '@/components/soul/auth/UserAvatarButton';
import { studioButton } from '@/lib/studioVariants';

interface TopBarProps {
  title: string;
  onExport: () => void;
  onOpenSearch: () => void;
}

export function TopBar({ title, onExport, onOpenSearch }: TopBarProps) {
  return (
    <div className="h-15 flex-none flex items-center gap-4 px-4.5 bg-acid-bg-subtle border-b border-acid-border-subtle">
      <div className="flex items-center gap-3.5 w-65">
        <Link
          href="/"
          aria-label="Ordio home"
          className="w-7.5 h-7.5 rounded-lg bg-acid-text-1 text-acid-bg-base flex items-center justify-center font-acid-display font-bold text-lg flex-none"
        >
          O
        </Link>
        <div className="flex flex-col min-w-0">
          <div className="font-acid-display font-semibold text-base text-acid-text-1 truncate">
            {title}
          </div>
          <div className="text-xs text-acid-text-3">ordio / voice clips</div>
        </div>
      </div>
      <div className="flex-1 flex justify-center">
        <button
          onClick={onOpenSearch}
          aria-label="Search actions, ask copilot"
          className="flex items-center gap-2.5 h-8.5 px-3 bg-acid-surface-1 border border-transparent rounded-acid-sm text-acid-text-3 text-sm min-w-75 hover:bg-acid-surface-2 transition-colors"
        >
          Search actions, ask copilot…
          <span className="ml-auto flex gap-0.5">
            <kbd className="bg-acid-surface-2 rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              ⌘
            </kbd>
            <kbd className="bg-acid-surface-2 rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              K
            </kbd>
          </span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button className={studioButton({ variant: 'primary' })} onClick={onExport}>
          Export ↗
        </button>
        <UserAvatarButton />
      </div>
    </div>
  );
}
