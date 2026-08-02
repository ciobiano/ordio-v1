'use client';

import { useUIStore } from '@/stores';
import { getCaptionStylePreset } from '@Ordio/engine';
import { ordSectionLabel, ordFieldCard } from '@/lib/ordioVariants';
import { ColorRow } from '../primitives/ColorRow';
import { SliderRow } from '../primitives/SliderRow';

const MAX_STROKE_WIDTH = 8;

/**
 * Colour controls, grouped Words / Caption box / Canvas the way the redesign
 * lays them out.
 *
 * Stroke and Shadow are still gated on the active preset declaring them
 * (`preset.stroke` / `preset.glow`) — the redesign exposes both unconditionally
 * for every preset, but that needs new schema defaults, so it lands in the
 * schema phase rather than this refactor. The grouping and the primitives are
 * already in their final shape, so that change is additive.
 */
export function ColorsTab() {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);

  const preset = getCaptionStylePreset(style.captionStyleId);

  return (
    <div className="flex flex-col gap-4">
      <span className={ordSectionLabel}>Words</span>
      <div className="flex flex-col gap-3">
        <ColorRow
          label="Caption text"
          value={style.textColor}
          onChange={(textColor) => setStyle({ textColor })}
        />
        <ColorRow
          label="Emphasis"
          hint="Words you tapped in Captions"
          value={style.accentColor ?? preset.accentColor ?? '#47D6CE'}
          onChange={(accentColor) => setStyle({ accentColor })}
        />
      </div>

      <span className={ordSectionLabel}>Caption box</span>
      <div className="flex flex-col gap-3">
        {preset.stroke && (
          <div className={ordFieldCard}>
            <ColorRow
              label="Stroke"
              value={style.strokeColor ?? preset.stroke.defaultColor}
              onChange={(strokeColor) => setStyle({ strokeColor })}
            />
            <SliderRow
              label="Stroke width"
              valueLabel={`${Math.round(
                ((style.strokeWidth ?? preset.stroke.defaultWidth) / MAX_STROKE_WIDTH) * 100
              )}%`}
              minLabel="None"
              maxLabel="Thick"
              min={0}
              max={MAX_STROKE_WIDTH}
              step={0.5}
              value={style.strokeWidth ?? preset.stroke.defaultWidth}
              onChange={(strokeWidth) => setStyle({ strokeWidth })}
            />
          </div>
        )}

        {preset.glow && (
          <div className={ordFieldCard}>
            <ColorRow
              label="Shadow"
              value={style.glowColor ?? preset.glow.defaultColor}
              onChange={(glowColor) => setStyle({ glowColor })}
            />
            <SliderRow
              label="Shadow intensity"
              valueLabel={`${Math.round((style.glowIntensity ?? preset.glow.defaultIntensity) * 100)}%`}
              minLabel="None"
              maxLabel="Heavy"
              min={0}
              max={1}
              step={0.05}
              value={style.glowIntensity ?? preset.glow.defaultIntensity}
              onChange={(glowIntensity) => setStyle({ glowIntensity })}
            />
          </div>
        )}

        {!preset.stroke && !preset.glow && (
          <p className="rounded-2xl bg-white/[0.05] p-4 text-[13px] leading-relaxed text-[color:var(--acid-text-3)]">
            This caption style has no stroke or shadow of its own — pick Cut or Script in Motion to
            edit those.
          </p>
        )}
      </div>

      <span className={ordSectionLabel}>Canvas</span>
      <div className="flex flex-col gap-3">
        <ColorRow
          label="Waveform"
          value={style.waveColor}
          onChange={(waveColor) => setStyle({ waveColor })}
        />
        <ColorRow
          label="Background"
          hint="Picking a colour drops the template"
          value={style.backgroundColor}
          onChange={(backgroundColor) =>
            setStyle({ backgroundColor, background: { type: 'solid', color: backgroundColor } })
          }
        />
      </div>
    </div>
  );
}
