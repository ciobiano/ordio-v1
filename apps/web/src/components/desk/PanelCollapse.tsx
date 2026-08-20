'use client';

/**
 * Collapse controls shared by the two side columns.
 *
 * The glyph is HugeIcons' sidebar mark — a panel with the collapsing edge
 * divided off — not a chevron. A chevron is generic disclosure: it says
 * "something opens" without saying what, and it has to be mirrored per side
 * to mean anything. The sidebar mark names the object being toggled and
 * carries its own handedness, so the left and right controls are the same
 * component with a different icon rather than two mirrored behaviours.
 *
 * Local glyphs in DeskIcons.tsx exist because the six rail tools have to read
 * as one drawn set. This is panel chrome, not part of that set, so it draws
 * from the house library the way the mobile components do.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarLeftIcon, SidebarRightIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { iconButton } from '@/lib/desk/deskVariants';

type Side = 'left' | 'right';

const ICON = { left: SidebarLeftIcon, right: SidebarRightIcon } as const;
const KEY = { left: '[', right: ']' } as const;

/**
 * One control for both directions. It is a toggle, so the icon stays put and
 * `aria-expanded` carries the state — swapping the glyph on collapse would
 * make it read as two different buttons in the same place.
 */
function CollapseToggle({
  side,
  expanded,
  label,
  size,
  onClick,
}: {
  side: Side;
  expanded: boolean;
  label: string;
  size: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${KEY[side]}`}
      aria-label={label}
      aria-expanded={expanded}
      className={cn(
        iconButton({ tone: 'bare', size: 'sm' }),
        size,
        'flex-none hover:bg-[var(--ord-paper)]/8'
      )}
    >
      <HugeiconsIcon icon={ICON[side]} size={16} strokeWidth={1.8} />
    </button>
  );
}

export function CollapseButton({
  side,
  label,
  onClick,
}: {
  side: Side;
  label: string;
  onClick: () => void;
}) {
  return (
    <CollapseToggle
      side={side}
      expanded
      label={label}
      size="size-6"
      onClick={onClick}
    />
  );
}

/**
 * What a collapsed column shows: the same toggle, plus the panel's name, so
 * the strip says what is behind it rather than reading as unexplained chrome.
 */
export function CollapsedStrip({
  side,
  label,
  onExpand,
}: {
  side: Side;
  label: string;
  onExpand: () => void;
}) {
  return (
    <div className="ord-collapsed-strip">
      <CollapseToggle
        side={side}
        expanded={false}
        label={`Show ${label.toLowerCase()}`}
        size="size-7"
        onClick={onExpand}
      />
      <span className="ord-collapsed-label ord-type-caps">{label}</span>
    </div>
  );
}
