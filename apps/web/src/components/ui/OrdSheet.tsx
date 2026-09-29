'use client';

import type { ReactNode } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * The one sheet.
 *
 * Every mobile sheet used to be its own thing: a floating shadcn Sheet inset
 * from the screen edges, an AlertDialog in a glass card, a vaul drawer with a
 * 28px radius, a hand-rolled panel. Five shapes for one idea. This is the
 * editor's panel shape — the one the design keeps — applied to all of them:
 * attached full-width to the bottom edge, 32px top corners, the sheet surface,
 * a hairline top rule, an upward shadow, and a 44px grab strip you can tap to
 * close or drag down to dismiss (vaul closes past a threshold or on a flick).
 *
 * Bottom padding is max(20px, safe-area inset), so the last button clears the
 * home indicator on an iPhone and sits 20px off the edge everywhere else.
 */

interface OrdSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name. Rendered as the visible heading unless `header` is false. */
  title: string;
  description?: ReactNode;
  /** A 44px round badge beside the title (the discard bin, the error mark). */
  icon?: ReactNode;
  /** A small pill above the title, e.g. COMING SOON. */
  eyebrow?: ReactNode;
  /** Round close button in the header's corner. */
  showClose?: boolean;
  /** `alertdialog` for confirmations that interrupt; scrim taps still cancel. */
  role?: 'dialog' | 'alertdialog';
  /** Draw no visible header — the content supplies its own. `title` still names the sheet. */
  header?: boolean;
  /** When false, drag and scrim tap do nothing (e.g. while a request is in flight). */
  dismissible?: boolean;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function OrdSheet({
  open,
  onOpenChange,
  title,
  description,
  icon,
  eyebrow,
  showClose = false,
  role = 'dialog',
  header = true,
  dismissible = true,
  className,
  children,
  footer,
}: OrdSheetProps) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          data-slot="ord-sheet-scrim"
          className="fixed inset-0 z-50 bg-[rgb(5_6_5/0.72)]"
        />
        <DrawerPrimitive.Content
          data-slot="ord-sheet"
          role={role}
          // Radix links the Description automatically; an explicit undefined when
          // there is none tells it the omission is deliberate (silences its warning).
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col outline-none',
            'rounded-t-[32px] border-t border-acid-text-1/8 bg-acid-surface-1 text-acid-text-1',
            'shadow-[0_-8px_40px_rgb(0_0_0/0.5)] px-4 safe-pb-dock',
            className
          )}
        >
          <DrawerPrimitive.Close
            aria-label="Close sheet"
            className="-mx-4 -mb-1.5 flex h-11 shrink-0 cursor-grab items-center justify-center border-none bg-transparent active:cursor-grabbing"
          >
            <span className="h-1.25 w-11 rounded-full bg-acid-text-1/28" />
          </DrawerPrimitive.Close>

          {header ? (
            <div className="flex shrink-0 items-start gap-3.5 pb-3.5">
              {icon && (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">{icon}</span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1 self-center">
                {eyebrow}
                <DrawerPrimitive.Title className="m-0 text-[17px] font-semibold leading-snug">
                  {title}
                </DrawerPrimitive.Title>
                {description && (
                  <DrawerPrimitive.Description className="m-0 text-[13px] leading-normal text-acid-text-3">
                    {description}
                  </DrawerPrimitive.Description>
                )}
              </div>
              {showClose && (
                <DrawerPrimitive.Close
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-acid-text-1/7 text-acid-text-1"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                </DrawerPrimitive.Close>
              )}
            </div>
          ) : (
            <DrawerPrimitive.Title className="sr-only">{title}</DrawerPrimitive.Title>
          )}

          {children && <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">{children}</div>}

          {footer && <div className="shrink-0 pt-3.5">{footer}</div>}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/** Two buttons side by side, the way out on the left and the commit on the right. */
export function OrdSheetActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-2.5', className)}>{children}</div>;
}

/** Mono caps label over a group of options inside a sheet. */
export function OrdSheetLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-acid-mono text-[11px] tracking-widest text-acid-text-3 uppercase', className)}>
      {children}
    </span>
  );
}
