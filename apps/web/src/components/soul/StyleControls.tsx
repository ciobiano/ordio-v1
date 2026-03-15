'use client';

import { cn } from '@/lib/cn';
import { optionBtn } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { StyleConfig } from '@Ordio/shared/schemas';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import LockBadge from '@/components/primitives/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

const FONTS: StyleConfig['fontFamily'][] = [
  'Inter', 'Roboto', 'Outfit',
  'Poppins', 'Montserrat', 'Space Grotesk', 'DM Sans', 'Playfair Display',
];

const fontFeatureKey: Partial<Record<StyleConfig['fontFamily'], FeatureKey>> = {
  Poppins: 'font_poppins',
  Montserrat: 'font_montserrat',
  'Space Grotesk': 'font_space_grotesk',
  'DM Sans': 'font_dm_sans',
  'Playfair Display': 'font_playfair',
};

interface StyleControlsProps {
  onLocked?: (feature: FeatureKey) => void;
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[--secondary] text-xs">{label}</span>
      <label className="flex items-center gap-2 cursor-pointer group min-h-11" aria-label={`${label} color`}>
        <span className="text-[--tertiary] text-xs tabular-nums uppercase">{value}</span>
        <div
          className="w-6 h-6 rounded-md border border-white/20 overflow-hidden
                     group-hover:border-white/40 transition-colors duration-150 shrink-0"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-label={`Pick ${label} color`}
        />
      </label>
    </div>
  );
}

export default function StyleControls({ onLocked }: StyleControlsProps) {
  const style = useStore((s) => s.style);
  const setStyle = useStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();

  return (
    <div className="flex flex-col gap-4">
      {/* Colors */}
      <div className="flex flex-col gap-2.5">
        <p className="text-[--tertiary] text-[0.625rem] uppercase tracking-[0.18em]">Colors</p>
        <ColorRow
          label="Waveform"
          value={style.waveColor}
          onChange={(v) => setStyle({ waveColor: v })}
        />
        <ColorRow
          label="Background"
          value={style.backgroundColor}
          onChange={(v) => setStyle({ backgroundColor: v })}
        />
        <ColorRow
          label="Text"
          value={style.textColor}
          onChange={(v) => setStyle({ textColor: v })}
        />
      </div>

      {/* Font */}
      <div className="flex flex-col gap-2">
        <p className="text-[--tertiary] text-[0.625rem] uppercase tracking-[0.18em]">Font</p>
        <div className="flex gap-2 flex-wrap">
          {FONTS.map((font) => {
            const featureKey = fontFeatureKey[font];
            const locked = featureKey ? isLocked(featureKey) : false;
            return (
              <div key={font} className="relative">
                <button
                  onClick={() => setStyle({ fontFamily: font })}
                  aria-pressed={style.fontFamily === font}
                  className={cn(optionBtn({ shape: 'bordered', tone: 'subtle', active: style.fontFamily === font }))}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
                {locked && featureKey && (
                  <LockBadge onClick={() => onLocked?.(featureKey)} label={`${font} requires Creator`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Font size */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[--tertiary] text-[0.625rem] uppercase tracking-[0.18em]">
            Font size
          </p>
          <span className="text-[--secondary] text-xs tabular-nums">{style.fontSize}px</span>
        </div>
        <input
          type="range"
          min={32}
          max={96}
          step={4}
          value={style.fontSize}
          onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
          aria-label="Font size"
          aria-valuemin={32}
          aria-valuemax={96}
          aria-valuenow={style.fontSize}
          className="w-full h-1 rounded-full accent-blue-500 cursor-pointer"
        />
      </div>
    </div>
  );
}
