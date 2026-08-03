'use client';

import { useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { TextWrapIcon, Clock01Icon, DashboardSquare02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { useProcessingStore, useUIStore } from '@/stores';
import type { BreakSettings } from '@/stores';
import type { BreakMode, BreakQuantity } from '@Ordio/engine/captions/breaks';
import { ordChip, ordFieldLabel } from '@/lib/ordioVariants';
import { SliderRow } from '../primitives/SliderRow';
import { ToggleRow } from '../primitives/ToggleRow';

const FREQUENCIES: { value: BreakMode; label: string }[] = [
  { value: 'punct', label: 'Punctuation or pause' },
  { value: 'single', label: 'Single word' },
  { value: 'time', label: 'Time' },
  { value: 'random', label: 'Random' },
];

const QUANTITIES: { value: BreakQuantity; label: string }[] = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
  { value: 3, label: 'Three' },
  { value: 4, label: 'Four' },
  { value: 5, label: 'Five' },
  { value: 6, label: 'Six' },
  { value: 7, label: 'Seven' },
  { value: 8, label: 'Eight' },
  { value: 'random', label: 'Random' },
];

/**
 * How the transcript is cut into captions.
 *
 * Unlike everything else in Style, this rewrites content rather than restyling
 * it — applying a rule discards manual splits and merges inside its scope. It
 * stays live (no Apply button) because the whole panel is live, and because the
 * transport bar's undo covers it: every change pushes one history entry.
 *
 * Quantity is its own row rather than a sub-option of Frequency, matching the
 * design. Tapping a count switches the mode to `quantity`, so the two rows are
 * one choice presented as two — the Frequency row deselects when you do.
 */
export function BreaksTab() {
  const breaks = useUIStore((s) => s.breaks);
  const setBreaks = useUIStore((s) => s.setBreaks);
  const resegmentCaptions = useProcessingStore((s) => s.resegmentCaptions);
  const selectedGroupIndices = useProcessingStore((s) => s.selectedGroupIndices);

  const selectedGroup =
    selectedGroupIndices.length > 0 ? selectedGroupIndices[selectedGroupIndices.length - 1] : null;

  const apply = useCallback(
    (next: Partial<BreakSettings>) => {
      const merged = { ...breaks, ...next };
      setBreaks(next);

      // With "apply to all" off we need a caption to act on; until one is
      // selected the setting is remembered but nothing is re-cut.
      const scope = merged.applyAll ? 'all' : selectedGroup;
      if (scope === null) return;

      resegmentCaptions(
        { mode: merged.mode, quantity: merged.quantity, holdSeconds: merged.holdSeconds },
        scope
      );
    },
    [breaks, setBreaks, resegmentCaptions, selectedGroup]
  );

  const scopeIsUnreachable = !breaks.applyAll && selectedGroup === null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col rounded-[20px] bg-white/[0.05]">
        <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5">
          <HugeiconsIcon
            icon={TextWrapIcon}
            size={19}
            strokeWidth={2}
            className="text-[color:var(--acid-text-3)]"
          />
          <span className="flex-1 text-base font-semibold text-[color:var(--acid-text-1)]">
            Line breaks
          </span>
        </div>

        <div className="flex items-center gap-3 px-4 pb-2.5 pt-1.5">
          <HugeiconsIcon
            icon={Clock01Icon}
            size={18}
            strokeWidth={2}
            className="text-[color:var(--acid-text-3)]"
          />
          <span className={cn(ordFieldLabel, 'flex-1 text-sm')}>Frequency</span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FREQUENCIES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={breaks.mode === option.value}
              onClick={() => apply({ mode: option.value })}
              className={cn(ordChip({ active: breaks.mode === option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mx-4 h-px bg-[color:var(--acid-border-default)]" />

        <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5">
          <HugeiconsIcon
            icon={DashboardSquare02Icon}
            size={18}
            strokeWidth={2}
            className="text-[color:var(--acid-text-3)]"
          />
          <span className={cn(ordFieldLabel, 'flex-1 text-sm')}>Quantity</span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUANTITIES.map((option) => {
            const active = breaks.mode === 'quantity' && breaks.quantity === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                aria-pressed={active}
                onClick={() => apply({ mode: 'quantity', quantity: option.value })}
                className={cn(ordChip({ active }))}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {breaks.mode === 'time' && (
        <SliderRow
          label="Hold each caption"
          valueLabel={`${breaks.holdSeconds.toFixed(1)}s`}
          minLabel="Snappy"
          maxLabel="Slow"
          min={1}
          max={6}
          step={0.5}
          value={breaks.holdSeconds}
          onChange={(holdSeconds) => apply({ holdSeconds })}
          className="px-1"
        />
      )}

      <ToggleRow
        label="Apply to all phrases"
        hint={
          scopeIsUnreachable
            ? 'Select a caption to re-cut just that one'
            : 'Off means this caption only'
        }
        checked={breaks.applyAll}
        onChange={(applyAll) => apply({ applyAll })}
      />
    </div>
  );
}
