'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CropIcon } from '@hugeicons/core-free-icons';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { captureSheetSurface } from '@/lib/variants';
import { ordStickerBtn, ordGhostBtn, ordOptionCard } from '@/lib/ordioVariants';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import type { FormatVariant } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import { LockPin } from '@/components/soul/captions/style/primitives/LockPin';

interface FormatEntry {
  value: FormatVariant;
  label: string;
  /** Proportional glyph dimensions, in px, drawn as an outlined rectangle. */
  width: number;
  height: number;
  gate?: FeatureKey;
}

const FORMATS: FormatEntry[] = [
  { value: 'square', label: '1:1', width: 22, height: 22 },
  { value: 'vertical', label: '9:16', width: 16, height: 26, gate: 'format_vertical' },
  { value: 'horizontal', label: '16:9', width: 28, height: 17, gate: 'format_horizontal' },
  { value: 'instagram', label: '4:5', width: 20, height: 25, gate: 'format_instagram' },
];

interface ReframeSheetProps {
  open: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

/**
 * Aspect ratio, chosen then committed.
 *
 * Two changes from the panel this replaces. Ratio is now *pending* until Apply,
 * because reframing recomposes the whole canvas and the old instant-apply made
 * browsing ratios destructive. And a locked ratio now guards the entire button:
 * previously only the padlock badge called the gate, so tapping the button body
 * applied a Creator ratio on a free account.
 *
 * Content fit (Fill / Fit / Auto) belongs in this sheet per the design, but the
 * frame renderer has no object-fit concept yet, so it lands with that work
 * rather than shipping as a control that changes nothing.
 */
export function ReframeSheet({ open, onClose, onLocked }: ReframeSheetProps) {
  const format = useUIStore((s) => s.format);
  const setFormat = useUIStore((s) => s.setFormat);
  const { isLocked } = useFeatureGates();

  const [pending, setPending] = useState<FormatVariant>(format);

  // Re-seed each time it opens, so a cancelled edit doesn't linger.
  useEffect(() => {
    if (open) setPending(format);
  }, [open, format]);

  const handleApply = () => {
    setFormat(pending);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent
        className={cn(
          captureSheetSurface,
          'flex flex-col gap-4 p-0 px-4 pb-6 pt-4.5',
          'sm:left-1/2 sm:max-w-[420px] sm:-translate-x-1/2'
        )}
      >
        <DrawerTitle className="flex items-center gap-2.5 text-base font-semibold text-[color:var(--acid-text-1)]">
          <HugeiconsIcon
            icon={CropIcon}
            size={18}
            strokeWidth={2}
            className="text-[color:var(--acid-accent)]"
          />
          Aspect ratio
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick the shape of your exported canvas, then apply it.
        </DrawerDescription>

        <div className="grid grid-cols-4 gap-2">
          {FORMATS.map((entry) => {
            const locked = entry.gate ? isLocked(entry.gate) : false;
            const active = pending === entry.value;

            return (
              <button
                key={entry.value}
                type="button"
                aria-pressed={active}
                aria-label={`${entry.label}${locked ? ' — requires Creator' : ''}`}
                onClick={() => {
                  if (locked && entry.gate) {
                    onLocked(entry.gate);
                    return;
                  }
                  setPending(entry.value);
                }}
                className={cn(
                  ordOptionCard({ active }),
                  'h-[76px] flex-col items-center justify-center gap-2 px-0'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'block rounded-[4px] border-[2.5px]',
                    active
                      ? 'border-[color:var(--acid-accent)]'
                      : 'border-[color:var(--acid-text-2)]'
                  )}
                  style={{ width: entry.width, height: entry.height }}
                />
                <span className="text-xs font-semibold text-[color:var(--acid-text-1)]">
                  {entry.label}
                </span>
                {locked && <LockPin position="card" />}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2.5 pt-1.5">
          <button type="button" onClick={onClose} className={cn(ordGhostBtn({ size: 'lg' }), 'flex-1')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={cn(ordStickerBtn({ tone: 'accent', size: 'lg' }), 'flex-1')}
          >
            Apply
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
