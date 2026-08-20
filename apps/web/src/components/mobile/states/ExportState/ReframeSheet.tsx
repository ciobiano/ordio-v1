'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CropIcon, FullScreenIcon, SquareArrowExpand01Icon, MagicWand01Icon } from '@hugeicons/core-free-icons';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { captureSheetSurface } from '@/lib/variants';
import { ordStickerBtn, ordGhostBtn, ordOptionCard } from '@/lib/variants';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import type { FormatVariant } from '@/stores';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { FeatureKey } from '@/lib/featureGates';
import { LockPin } from '@/components/mobile/captions/style/controls/LockPin';

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

type ContentFit = NonNullable<StyleConfig['contentFit']>;

const FITS: { value: ContentFit; label: string; icon: typeof CropIcon; hint: string }[] = [
  { value: 'fill', label: 'Fill', icon: FullScreenIcon, hint: 'Crop to cover the frame' },
  { value: 'fit', label: 'Fit', icon: SquareArrowExpand01Icon, hint: 'Show all of it, letterboxed' },
  { value: 'auto', label: 'Auto', icon: MagicWand01Icon, hint: 'Crop when the shapes are close' },
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
 * Content fit applies to photo and video backdrops. Canvas-preset artwork is
 * always covered: those are authored as full-bleed squares that are meant to
 * *be* the canvas, so letterboxing one would frame a background rather than
 * fill it.
 */
export function ReframeSheet({ open, onClose, onLocked }: ReframeSheetProps) {
  const format = useUIStore((s) => s.format);
  const setFormat = useUIStore((s) => s.setFormat);
  const contentFit = useUIStore((s) => s.style.contentFit ?? 'fill');
  const setStyle = useUIStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();

  const [pending, setPending] = useState<FormatVariant>(format);
  const [pendingFit, setPendingFit] = useState<ContentFit>(contentFit);

  // Re-seed each time it opens, so a cancelled edit doesn't linger.
  useEffect(() => {
    if (open) {
      setPending(format);
      setPendingFit(contentFit);
    }
  }, [open, format, contentFit]);

  const handleApply = () => {
    setFormat(pending);
    setStyle({ contentFit: pendingFit });
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
            // A heading icon is decoration, not a chosen value — the two
            // selected states below are what earn lime in this sheet.
            className="text-[color:var(--acid-text-3)]"
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

        <div className="flex items-center gap-2.5 pt-0.5">
          <HugeiconsIcon
            icon={FullScreenIcon}
            size={18}
            strokeWidth={2}
            className="text-[color:var(--acid-text-3)]"
          />
          <span className="text-base font-semibold text-[color:var(--acid-text-1)]">Content fit</span>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Content fit">
          {FITS.map((fit) => {
            const active = pendingFit === fit.value;
            return (
              <button
                key={fit.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${fit.label} — ${fit.hint}`}
                onClick={() => setPendingFit(fit.value)}
                className={cn(
                  ordOptionCard({ active }),
                  'h-16 flex-col items-center justify-center gap-1.5 px-0'
                )}
              >
                <HugeiconsIcon
                  icon={fit.icon}
                  size={20}
                  strokeWidth={2}
                  className={
                    active
                      ? 'text-[color:var(--acid-accent)]'
                      : 'text-[color:var(--acid-text-2)]'
                  }
                />
                <span className="text-xs font-semibold text-[color:var(--acid-text-1)]">
                  {fit.label}
                </span>
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
            className={cn(
              ordStickerBtn({ tone: 'accent', size: 'lg', elevation: 'flat' }),
              'flex-1'
            )}
          >
            Apply
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
