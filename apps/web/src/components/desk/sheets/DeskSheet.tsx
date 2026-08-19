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
  /** Card width. Palette is wider because it lists results. */
  width?: 'narrow' | 'wide';
  /** The palette anchors near the top; everything else centres. */
  align?: 'center' | 'top';
  children: React.ReactNode;
}

export function DeskSheet({
  title,
  onClose,
  width = 'narrow',
  align = 'center',
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
        'fixed inset-0 z-60 flex justify-center bg-[var(--ord-ink)]/72 p-6 backdrop-blur-[2px]',
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
          'ord-animate-fade flex max-h-full flex-col gap-3.5 overflow-hidden rounded-[18px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 outline-none',
          width === 'wide' ? 'w-[560px]' : 'w-[420px]',
          'max-w-full'
        )}
      >
        {children}
      </div>
    </div>
  );
}
