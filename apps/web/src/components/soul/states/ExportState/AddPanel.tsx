'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import { Mic01Icon, Upload04Icon, Image02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ordSectionLabel, ordFieldHint } from '@/lib/ordioVariants';

interface AddPanelProps {
  onUploadBackdrop: () => void;
  onPickArtwork: () => void;
}

interface AddItem {
  id: string;
  label: string;
  hint: string;
  icon: IconSvgElement;
  onSelect?: () => void;
}

/**
 * Ways to bring something new onto the canvas.
 *
 * "Record more" is in the design but has no flow behind it — appending a second
 * clip to an existing recording is not something the pipeline can do yet, so it
 * renders disabled with an honest hint rather than as a button that does
 * nothing. It becomes live when multi-clip capture lands.
 */
export function AddPanel({ onUploadBackdrop, onPickArtwork }: AddPanelProps) {
  const items: AddItem[] = [
    {
      id: 'record',
      label: 'Record more',
      hint: 'Coming soon — one clip per canvas for now',
      icon: Mic01Icon,
    },
    {
      id: 'backdrop',
      label: 'Upload a backdrop',
      hint: 'Your own video or image',
      icon: Upload04Icon,
      onSelect: onUploadBackdrop,
    },
    {
      id: 'artwork',
      label: 'Pick artwork',
      hint: 'Twenty canvases, one per mood',
      icon: Image02Icon,
      onSelect: onPickArtwork,
    },
  ];

  return (
    <div className="flex flex-col gap-2 px-4 pb-5 pt-0.5">
      <span className={cn(ordSectionLabel, 'pb-1')}>Add to this canvas</span>

      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onSelect}
          disabled={!item.onSelect}
          className={cn(
            'flex items-center gap-3.5 rounded-2xl border-2 border-transparent bg-white/[0.05] p-3.5 text-left',
            'transition-colors duration-[var(--acid-dur-tap)]',
            'enabled:cursor-pointer enabled:hover:bg-white/[0.08]',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {/* Fill, not tint. These chips were lime / info-blue / premium-amber —
              three saturated objects decorating a menu, one of them lime. Worse,
              premium means "gated" and this row is the one that isn't; the gated
              row was wearing info-blue. Semantic tokens spent as decoration is how
              the vocabulary stops meaning anything (DESIGN.md §4, §5). */}
          <span
            className={cn(
              'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl',
              'bg-white/[0.10] text-[color:var(--acid-text-1)]'
            )}
          >
            <HugeiconsIcon icon={item.icon} size={20} strokeWidth={2} />
          </span>

          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[color:var(--acid-text-1)]">
              {item.label}
            </span>
            <span className={ordFieldHint}>{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
