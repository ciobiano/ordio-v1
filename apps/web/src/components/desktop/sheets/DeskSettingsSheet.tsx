'use client';

/**
 * Audio settings for the desk.
 *
 * The desk's Settings button used to open the waitlist sheet — a placeholder
 * standing in for a surface that did not exist, so the one control that
 * changes what happens to your audio asked you to join a mailing list.
 *
 * Mobile's equivalent is a Vaul bottom drawer, which is a phone gesture: it
 * rises from the thumb, is dismissed by dragging down, and is sized against a
 * viewport held in one hand. On a 1670px desk it would be a full-width band
 * pinned to the bottom of the screen. So this is the same choice in the desk's
 * own modal instead, and the two share the store rather than the chrome.
 */

import { useProcessingStore, type EnhanceTier } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import type { FeatureKey } from '@/lib/featureGates';
import { cn } from '@/lib/utils';
import { DeskSheet, DeskSheetHeader, DeskSheetLabel } from './DeskSheet';
import { RadioDot } from '@/components/ui/SheetGlyphs';
import { sheetButton, sheetOption } from '@/lib/variants';

const TIERS: {
  value: EnhanceTier;
  label: string;
  hint: string;
  gate?: FeatureKey;
}[] = [
  { value: 'none', label: 'Standard', hint: 'No processing — fastest' },
  { value: 'clean', label: 'Clean', hint: 'AI noise removal · about 3s', gate: 'enhance_clean' },
  { value: 'hd', label: 'HD Remaster', hint: 'Denoise and enhance · about 15s', gate: 'enhance_hd' },
];

interface DeskSettingsSheetProps {
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export function DeskSettingsSheet({ onClose, onLocked }: DeskSettingsSheetProps) {
  const enhanceTier = useProcessingStore((s) => s.enhanceTier);
  const setEnhanceTier = useProcessingStore((s) => s.setEnhanceTier);
  const { isLocked } = useFeatureGates();

  return (
    <DeskSheet title="Audio settings" onClose={onClose}>
      <DeskSheetHeader
        title="Audio settings"
        subtitle="Applied when a recording is processed, not while it is captured."
        onClose={onClose}
      />

      <DeskSheetLabel>Enhancement</DeskSheetLabel>
      <div role="radiogroup" aria-label="Enhancement" className="-mt-1.5 flex flex-col gap-2">
        {TIERS.map((tier) => {
          const locked = tier.gate ? isLocked(tier.gate) : false;
          const selected = enhanceTier === tier.value;
          return (
            <button
              key={tier.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => (locked && tier.gate ? onLocked(tier.gate) : setEnhanceTier(tier.value))}
              className={cn(sheetOption({ selected }), locked && 'opacity-55')}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-[var(--ord-paper)]">{tier.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{tier.hint}</span>
              </span>
              {locked ? (
                <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--acid-premium)]">LOCKED</span>
              ) : (
                <RadioDot on={selected} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button type="button" onClick={onClose} className={cn(sheetButton({ tone: 'secondary' }), 'h-11 w-auto px-4.5 text-sm')}>
          Done
        </button>
      </div>
    </DeskSheet>
  );
}
