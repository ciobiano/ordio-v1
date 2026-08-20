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
import { DeskSheet } from './DeskSheet';

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
      <div className="flex flex-col gap-1">
        <span className="ord-type-subtitle font-bold text-[var(--ord-paper)]">
          Audio settings
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          Applied when a recording is processed, not while it is captured.
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="ord-eyebrow pb-2">Enhancement</legend>
        {TIERS.map((tier) => {
          const locked = tier.gate ? isLocked(tier.gate) : false;
          const selected = enhanceTier === tier.value;
          return (
            <button
              key={tier.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                locked && tier.gate ? onLocked(tier.gate) : setEnhanceTier(tier.value)
              }
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-[var(--dur-tap)]',
                selected
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5 hover:bg-[var(--ord-paper)]/8',
                locked && 'opacity-45'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 flex-none items-center justify-center rounded-full border-2',
                  selected
                    ? 'border-[var(--ord-acid)]'
                    : 'border-[var(--text-muted)]'
                )}
              >
                {selected && (
                  <span className="size-1.5 rounded-full bg-[var(--ord-acid)]" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="ord-type-label font-semibold text-[var(--ord-paper)]">
                  {tier.label}
                </span>
                <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
                  {tier.hint}
                </span>
              </span>
              {locked && <span className="ord-type-micro text-[var(--acid-premium)]">Locked</span>}
            </button>
          );
        })}
      </fieldset>
    </DeskSheet>
  );
}
