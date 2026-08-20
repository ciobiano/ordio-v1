'use client';

import { useUIStore } from '@/stores';
import type { StyleConfig } from '@Ordio/shared/schemas';
import { SegmentedRow } from '../controls/SegmentedRow';
import { SliderRow } from '../controls/SliderRow';

/** 'Auto' keeps each caption style's own waveform-aware placement. */
const POSITION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
] as const satisfies readonly { value: NonNullable<StyleConfig['verticalAlign']>; label: string }[];

/** Line spacing is edited as an offset from 1 and stored as a raw lineHeight. */
const LINE_SPACING_BASE = 1;
const MIN_LINE_SPACING = -0.6;
const MAX_LINE_SPACING = 1.4;
const MIN_LINE_HEIGHT = 0.4;

const MIN_CHARACTER_SPACING = -12;
const MAX_CHARACTER_SPACING = 12;

/**
 * Where the caption block sits and how tightly it's set. Alignment used to live
 * here; the redesign moved it to Font, leaving this tab to answer only "where on
 * the canvas".
 */
export function LayoutTab() {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);

  const lineSpacing = (style.lineHeight ?? 1.4) - LINE_SPACING_BASE;

  return (
    <div className="flex flex-col gap-4">
      <SegmentedRow
        label="Position"
        options={POSITION_OPTIONS}
        value={style.verticalAlign ?? 'auto'}
        onChange={(verticalAlign) => setStyle({ verticalAlign })}
      />

      <SliderRow
        label="Line spacing"
        valueLabel={(LINE_SPACING_BASE + lineSpacing).toFixed(2)}
        minLabel="Tight"
        maxLabel="Loose"
        min={MIN_LINE_SPACING}
        max={MAX_LINE_SPACING}
        step={0.01}
        value={lineSpacing}
        onChange={(next) =>
          setStyle({ lineHeight: Math.max(MIN_LINE_HEIGHT, LINE_SPACING_BASE + next) })
        }
      />

      <SliderRow
        label="Character spacing"
        valueLabel={`${(style.characterSpacing ?? 0).toFixed(1)}px`}
        minLabel="Tighter"
        maxLabel="Wider"
        min={MIN_CHARACTER_SPACING}
        max={MAX_CHARACTER_SPACING}
        step={0.1}
        value={style.characterSpacing ?? 0}
        onChange={(next) => setStyle({ characterSpacing: Number(next.toFixed(2)) })}
      />
    </div>
  );
}
