'use client';

import { useEffect } from 'react';
import { loadFont } from '@Ordio/engine/loaders';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { FeatureKey } from '@/lib/featureGates';
import { OptionCard } from '../primitives/OptionCard';
import { SliderRow } from '../primitives/SliderRow';
import { SegmentedRow } from '../primitives/SegmentedRow';
import { ToggleRow } from '../primitives/ToggleRow';

type FontFamily = StyleConfig['fontFamily'];

interface FontEntry {
  name: FontFamily;
  caption: string;
  stack: string;
  gate?: FeatureKey;
}

/** The eleven faces that ship with Ordio; five come with Creator. */
const FONTS: FontEntry[] = [
  { name: 'Inter', caption: 'Neutral', stack: "'Inter', sans-serif" },
  { name: 'Roboto', caption: 'Clean', stack: "'Roboto', sans-serif" },
  { name: 'Outfit', caption: 'Rounded', stack: "'Outfit', sans-serif" },
  { name: 'Poppins', caption: 'Modern', stack: "'Poppins', sans-serif", gate: 'font_poppins' },
  { name: 'Montserrat', caption: 'Editorial', stack: "'Montserrat', sans-serif", gate: 'font_montserrat' },
  { name: 'Space Grotesk', caption: 'Technical', stack: "'Space Grotesk', sans-serif", gate: 'font_space_grotesk' },
  { name: 'DM Sans', caption: 'Soft', stack: "'DM Sans', sans-serif", gate: 'font_dm_sans' },
  { name: 'Playfair Display', caption: 'Display', stack: "'Playfair Display', serif", gate: 'font_playfair' },
  { name: 'Lora', caption: 'Serif', stack: "'Lora', serif" },
  { name: 'Instrument Serif', caption: 'Cinematic', stack: "'Instrument Serif', serif" },
  { name: 'Instrument Sans', caption: 'Grotesk', stack: "'Instrument Sans', sans-serif" },
];

const ALIGN_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
] as const satisfies readonly { value: NonNullable<StyleConfig['textAlign']>; label: string }[];

/** Labels are the casing they produce, so the control demonstrates itself. */
const CASE_OPTIONS = [
  { value: 'none', label: 'As spoken' },
  { value: 'uppercase', label: 'AA' },
  { value: 'lowercase', label: 'aa' },
  { value: 'capitalize', label: 'Aa' },
] as const satisfies readonly { value: NonNullable<StyleConfig['textTransform']>; label: string }[];

interface FontTabProps {
  onLocked?: (feature: FeatureKey) => void;
}

/**
 * Typeface, alignment and size.
 *
 * Alignment moved here from Spacing/Layout — the redesign groups it with the
 * face because both answer "how do the words sit", where Layout now only
 * answers "where on the canvas".
 *
 * Capitalization only restyles the paint: the transcript keeps the user's own
 * words verbatim, so switching back to "As spoken" is lossless.
 *
 * Auto fit reverses the standing fixed-size rule on purpose and ships on. With
 * it off, one size holds for the whole clip and long phrases wrap; with it on,
 * each block scales to fill the frame, so short phrases read large.
 */
export function FontTab({ onLocked }: FontTabProps) {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();

  // Preload every face so each tile previews in the typeface it names.
  useEffect(() => {
    void Promise.allSettled(FONTS.map((font) => loadFont(font.name)));
  }, []);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2">
        {FONTS.map((font) => {
          const locked = font.gate ? isLocked(font.gate) : false;
          return (
            <OptionCard
              key={font.name}
              layout="tile"
              label={font.name}
              caption={font.caption}
              fontFamily={font.stack}
              active={style.fontFamily === font.name}
              locked={locked}
              onSelect={() => {
                if (locked && font.gate) {
                  onLocked?.(font.gate);
                  return;
                }
                setStyle({ fontFamily: font.name });
              }}
            />
          );
        })}
      </div>

      <SegmentedRow
        label="Alignment"
        options={ALIGN_OPTIONS}
        value={style.textAlign ?? 'center'}
        onChange={(textAlign) => setStyle({ textAlign })}
      />

      <SegmentedRow
        label="Capitalization"
        options={CASE_OPTIONS}
        value={style.textTransform ?? 'none'}
        onChange={(textTransform) => setStyle({ textTransform })}
      />

      <ToggleRow
        label="Auto fit"
        hint="Ordio sizes each line to the canvas"
        checked={style.autoFit ?? false}
        onChange={(autoFit) => setStyle({ autoFit })}
      />

      <SliderRow
        label="Font size"
        valueLabel={`${style.fontSize}px`}
        minLabel="Small"
        maxLabel="Large"
        min={32}
        max={96}
        step={1}
        value={style.fontSize}
        onChange={(fontSize) => setStyle({ fontSize })}
        // Auto fit decides the size, so the slider only sets the starting point.
        muted={style.autoFit ?? false}
      />

      <ToggleRow
        label="Hide auto punctuation"
        hint="Drop the commas and stops we added"
        checked={style.hidePunctuation ?? false}
        onChange={(hidePunctuation) => setStyle({ hidePunctuation })}
      />
    </div>
  );
}
