'use client';

import { useEffect, useState } from 'react';
import { OrdSheet, OrdSheetActions, OrdSheetLabel } from '@/components/ui/OrdSheet';
import { RadioDot } from '@/components/ui/SheetGlyphs';
import { cn } from '@/lib/utils';
import { sheetButton, sheetOption } from '@/lib/variants';
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

const FITS: { value: ContentFit; label: string; hint: string }[] = [
  { value: 'fill', label: 'Fill', hint: 'Crop to cover the frame' },
  { value: 'fit', label: 'Fit', hint: 'Show all of it, letterboxed' },
  { value: 'auto', label: 'Auto', hint: 'Crop when the shapes are close' },
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
    <OrdSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Reframe"
      description="Pick the shape of your exported canvas, then apply it."
      showClose
      footer={
        <OrdSheetActions>
          <button type="button" onClick={onClose} className={sheetButton({ tone: 'secondary' })}>
            Cancel
          </button>
          <button type="button" onClick={handleApply} className={sheetButton({ tone: 'primary' })}>
            Apply
          </button>
        </OrdSheetActions>
      }
    >
      <OrdSheetLabel>Aspect ratio</OrdSheetLabel>
      <div
        role="radiogroup"
        aria-label="Aspect ratio"
        className="-mt-1 grid grid-cols-4 gap-1 rounded-[14px] bg-acid-text-1/6 p-1"
      >
        {FORMATS.map((entry) => {
          const locked = entry.gate ? isLocked(entry.gate) : false;
          const active = pending === entry.value;

          return (
            <button
              key={entry.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${entry.label}${locked ? ' — requires Creator' : ''}`}
              onClick={() => {
                if (locked && entry.gate) {
                  onLocked(entry.gate);
                  return;
                }
                setPending(entry.value);
              }}
              className={cn(
                'relative flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border-none font-acid-mono text-xs transition-colors duration-100',
                active ? 'bg-acid-text-1 text-acid-on-accent' : 'bg-transparent text-acid-text-2 hover:bg-acid-text-1/6'
              )}
            >
              <span
                aria-hidden="true"
                className="block rounded-[3px] border-[1.5px] border-current"
                style={{ width: entry.width * 0.9, height: entry.height * 0.9 }}
              />
              {entry.label}
              {locked && <LockPin position="card" />}
            </button>
          );
        })}
      </div>

      <OrdSheetLabel>Content fit</OrdSheetLabel>
      <div className="-mt-1 flex flex-col gap-2" role="radiogroup" aria-label="Content fit">
        {FITS.map((fit) => {
          const active = pendingFit === fit.value;
          return (
            <button
              key={fit.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPendingFit(fit.value)}
              className={sheetOption({ selected: active })}
            >
              <span className="w-11 text-[15px] font-medium text-acid-text-1">{fit.label}</span>
              <span className="flex-1 text-[13px] text-acid-text-3">{fit.hint}</span>
              <RadioDot on={active} />
            </button>
          );
        })}
      </div>
    </OrdSheet>
  );
}
