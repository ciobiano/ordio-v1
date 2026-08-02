'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, HelpCircleIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ordStickerBtn } from '@/lib/ordioVariants';

interface ExportHeaderProps {
  /** 'Export' before a render exists, 'Retry export' after a failed attempt,
   *  'Save' once a render does — one primary action; the overlay owns the rest. */
  primaryLabel: string;
  primaryDisabled: boolean;
  onBack: () => void;
  onPrimary: () => void;
  onHelp?: () => void;
}

/** Shared shape for the two icon pills flanking the canvas. */
const iconPill = cn(
  'pointer-events-auto flex h-[46px] w-[46px] items-center justify-center rounded-2xl',
  'border-[3px] border-[color:var(--acid-bg-base)] bg-[color:var(--acid-surface-1)]/85',
  'text-[color:var(--acid-text-1)] backdrop-blur-sm cursor-pointer',
  'transition-colors hover:bg-[color:var(--acid-surface-2)]'
);

/**
 * Floating controls over the top of the canvas.
 *
 * Replaces the fixed 54px bar: the canvas now runs to the top of the stage and
 * the controls sit on it as separate pills, so nothing steals a strip of height
 * from the artwork. The row is `pointer-events-none` with each pill opting back
 * in, so the gap between them stays draggable canvas.
 */
export function ExportHeader({
  primaryLabel,
  primaryDisabled,
  onBack,
  onPrimary,
  onHelp,
}: ExportHeaderProps) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-2 z-30 flex items-center justify-between">
      <button type="button" onClick={onBack} aria-label="Close" className={iconPill}>
        <HugeiconsIcon icon={Cancel01Icon} size={21} strokeWidth={2.2} />
      </button>

      <div className="pointer-events-auto flex items-center gap-2.5">
        {onHelp && (
          <button type="button" onClick={onHelp} aria-label="Help" className={iconPill}>
            <HugeiconsIcon icon={HelpCircleIcon} size={21} strokeWidth={2} />
          </button>
        )}

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          aria-label={primaryLabel}
          className={cn(ordStickerBtn({ tone: 'accent', shape: 'square', size: 'md' }))}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
