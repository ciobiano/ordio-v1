'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface ExportHeaderProps {
  /** 'Export' before a render exists, 'Retry export' after a failed attempt,
   *  'Save' once a render does — one primary action; the overlay owns the rest. */
  primaryLabel: string;
  primaryDisabled: boolean;
  onBack: () => void;
  onPrimary: () => void;
}

/**
 * Solid top bar: back, wordmark, primary action.
 *
 * The design shipped this alongside a floating-pill variant that sat over the
 * canvas. This one is in flow, so it costs 54px of height the artwork could
 * have used — the trade is a stable, opaque strip that never competes with
 * whatever is behind it, and a centred wordmark that gives the screen an
 * anchor.
 *
 * The wordmark is set in type, always lowercase, never drawn as a mark — Ordio
 * has no logo asset and the design system is explicit that one should not be
 * reconstructed.
 */
export function ExportHeader({
  primaryLabel,
  primaryDisabled,
  onBack,
  onPrimary,
}: ExportHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-[54px] shrink-0 items-center justify-between px-3.5',
        'border-b border-[color:var(--acid-border-default)] bg-[color:var(--acid-bg-base)]'
      )}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className={cn(
          'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full',
          'bg-white/[0.10] text-[color:var(--acid-text-1)] transition-colors',
          'hover:bg-white/[0.16] active:scale-[0.97]'
        )}
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={2} />
      </button>

      <span
        aria-hidden="true"
        className="text-[19px] font-bold tracking-[-0.03em] text-[color:var(--acid-accent)]"
      >
        ordio
      </span>

      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        aria-label={primaryLabel}
        className={cn(
          'cursor-pointer px-3 py-2.5 text-[17px] font-semibold tracking-[0.01em]',
          'text-[color:var(--acid-accent)] transition-opacity',
          'hover:opacity-80 active:scale-[0.97]',
          'disabled:cursor-not-allowed disabled:opacity-30'
        )}
      >
        {primaryLabel}
      </button>
    </header>
  );
}
