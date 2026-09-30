'use client';

/**
 * The modal shell every editor sheet sits in.
 *
 * Owns the behaviour that is easy to forget per-sheet and impossible to
 * retrofit consistently: Escape closes, the backdrop closes but the card
 * swallows its own clicks, focus moves into the card on open and returns to
 * whatever opened it on close, and the page behind stops scrolling.
 */

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DeskSheetProps {
  title: string;
  onClose: () => void;
  /** Card width. Palette is wider because it lists results; a running or
   *  finished export is a two-column card with the video on the left. */
  width?: 'narrow' | 'wide' | 'split';
  /** Drop the card's own padding, for a layout that draws edge to edge. */
  bleed?: boolean;
  /** The palette anchors near the top; everything else centres. */
  align?: 'center' | 'top';
  children: React.ReactNode;
}

export function DeskSheet({
  title,
  onClose,
  width = 'narrow',
  align = 'center',
  bleed = false,
  children,
}: DeskSheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    openerRef.current?.focus?.();
    onClose();
  }, [onClose]);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    // Capture phase: the shell's global shortcut handler also listens on
    // window, and Escape here must not fall through to it.
    window.addEventListener('keydown', onKey, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [close]);

  return (
    <div
      onClick={close}
      className={cn(
        'fixed inset-0 z-60 flex justify-center bg-[var(--ord-ink)]/72 p-4 backdrop-blur-[2px]',
        align === 'top' ? 'items-start pt-[12vh]' : 'items-center'
      )}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'ord-sheet-card ord-animate-fade flex max-h-full flex-col gap-4 overflow-hidden rounded-[32px] border border-[var(--border-hairline)] bg-[var(--surface-raised)] shadow-[0_40px_120px_rgb(0_0_0/0.7)] outline-none',
          bleed ? 'p-0' : 'p-5',
          width === 'split' ? 'w-[680px]' : width === 'wide' ? 'w-[560px]' : 'w-[440px]',
          'max-w-full'
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Title, an optional line under it, and a round close — every sheet's head. */
export function DeskSheetHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-none items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="m-0 truncate text-[17px] font-semibold text-[var(--ord-paper)]">{title}</h2>
        {subtitle && <span className="truncate text-[13px] text-[var(--text-muted)]">{subtitle}</span>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close · Esc"
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--ord-paper)]/7 text-[var(--ord-paper)] transition-colors duration-[var(--dur-tap)] hover:bg-[var(--ord-paper)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** The mono caps label over a group of options in a sheet. */
export function DeskSheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-widest text-[var(--text-muted)] uppercase">
      {children}
    </span>
  );
}
