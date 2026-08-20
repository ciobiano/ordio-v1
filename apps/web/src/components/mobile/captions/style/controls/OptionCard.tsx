'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ordOptionCard, ordCheckPill, ordFieldHint } from '@/lib/ordioVariants';
import { LockPin } from './LockPin';

interface OptionCardProps {
  label: string;
  hint?: string;
  active: boolean;
  onSelect: () => void;
  /** Renders the padlock pin. The parent still owns the gate — see below. */
  locked?: boolean;
  layout?: 'row' | 'tile';
  /** Tile layout only: renders the label in the face it names. */
  fontFamily?: string;
  /** Tile layout only: the semantic caption under the name ("Neutral"). */
  caption?: string;
  children?: React.ReactNode;
}

/**
 * Selectable card, shared by Motion rows, Visual rows and Font tiles.
 *
 * Gating contract: a locked card still fires `onSelect`. The caller is expected
 * to wrap that callback in its feature gate, the way the design's `gate(key, fn)`
 * does — so the upgrade sheet opens from anywhere on the card, not just from the
 * padlock. This is the fix for locked options being applicable by tapping past
 * the badge.
 */
export function OptionCard({
  label,
  hint,
  active,
  onSelect,
  locked = false,
  layout = 'row',
  fontFamily,
  caption,
  children,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(ordOptionCard({ layout, active }))}
    >
      {layout === 'tile' ? (
        <>
          <span
            className="truncate text-base font-bold leading-none text-[color:var(--acid-text-1)]"
            style={fontFamily ? { fontFamily } : undefined}
          >
            {label}
          </span>
          {caption && (
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--acid-text-3)]">
              {caption}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold leading-none text-[color:var(--acid-text-1)]">
              {label}
            </span>
            {hint && <span className={ordFieldHint}>{hint}</span>}
          </span>

          {children}

          <span className={cn(ordCheckPill({ active }))} aria-hidden="true">
            <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={3} />
          </span>
        </>
      )}

      {locked && <LockPin position={layout === 'tile' ? 'tile' : 'card'} />}
    </button>
  );
}
