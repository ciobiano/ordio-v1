'use client';

import { cn } from '@/lib/utils';
import { optionBtn } from '@/lib/variants';
import { Slider } from '@/components/ui/slider';
import { useUIStore } from '@/stores';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionAnimation } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
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

const ANIMATION_OPTIONS: { value: CaptionAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'sweep-pulse', label: 'Sweep + Pulse' },
];

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
      <span className="text-muted-foreground text-xs">{label}</span>
      <label className="flex items-center gap-2 cursor-pointer group min-h-11" aria-label={`${label} color`}>
        <span className="text-muted-foreground text-xs tabular-nums uppercase">{value}</span>
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
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const captionAnimation = useUIStore((s) => s.captionAnimation);
  const setCaptionAnimation = useUIStore((s) => s.setCaptionAnimation);
  const { isLocked } = useFeatureGates();

  return (
    <div className="flex flex-col gap-4">

      {/* Colors */}
      <div className="flex flex-col gap-2.5">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
          Colors
        </p>
        <ColorRow label="Waveform"   value={style.waveColor}        onChange={(v) => setStyle({ waveColor: v })} />
        <ColorRow label="Background" value={style.backgroundColor}  onChange={(v) => setStyle({ backgroundColor: v })} />
        <ColorRow label="Text"       value={style.textColor}        onChange={(v) => setStyle({ textColor: v })} />
      </div>

      {/* Font */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
          Font
        </p>
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
            Font size
          </p>
          <span className="text-muted-foreground text-xs tabular-nums">
            {style.fontSize}px
          </span>
        </div>
        <Slider
          min={32}
          max={96}
          step={4}
          value={[style.fontSize]}
          onValueChange={(val) => setStyle({ fontSize: Array.isArray(val) ? val[0] : val })}
          aria-label="Font size"
        />
      </div>

      {/* Animation */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
          Animation
        </p>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Caption animation">
          {ANIMATION_OPTIONS.map(({ value, label }) => {
            const selected = captionAnimation === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setCaptionAnimation(value)}
                className={cn(optionBtn({ shape: 'bordered', tone: 'subtle', active: selected }))}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Line height */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
            Line height
          </p>
          <span className="text-muted-foreground text-xs tabular-nums">
            {(style.lineHeight ?? 1.4).toFixed(2)}
          </span>
        </div>
        <Slider
          min={1}
          max={2.4}
          step={0.05}
          value={[style.lineHeight ?? 1.4]}
          onValueChange={(val) => setStyle({ lineHeight: Array.isArray(val) ? val[0] : val })}
          aria-label="Line height"
        />
      </div>

      {/* Character spacing */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.15em]">
            Character spacing
          </p>
          <span className="text-muted-foreground text-xs tabular-nums">
            {style.characterSpacing ?? 0}px
          </span>
        </div>
        <Slider
          min={0}
          max={12}
          step={1}
          value={[style.characterSpacing ?? 0]}
          onValueChange={(val) => setStyle({ characterSpacing: Array.isArray(val) ? val[0] : val })}
          aria-label="Character spacing"
        />
      </div>
    </div>
  );
}
