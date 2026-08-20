'use client';

import { useUIStore } from '@/stores';
import { getCaptionStylePreset } from '@Ordio/engine';
import { ordSectionLabel, ordFieldCard } from '@/lib/variants';
import { ColorRow } from '../controls/ColorRow';
import { ColorSwatch } from '../controls/ColorSwatch';
import { SliderRow } from '../controls/SliderRow';
import { ToggleRow } from '../controls/ToggleRow';

const MAX_STROKE_WIDTH = 8;

/** Shown when neither the style nor the user has set one. Hex, because the
 *  schema constrains these fields to hex and the engine's own fallback is an
 *  rgba() the colour input can't represent. */
const FALLBACK_STROKE_COLOR = '#000000';
const FALLBACK_SHADOW_COLOR = '#000000';
const FALLBACK_EMPHASIS_COLOR = '#47D6CE';
const FALLBACK_CHIP_COLOR = '#22D3EE';
const FALLBACK_CHIP_TEXT_COLOR = '#111111';
const FALLBACK_CAPTION_BG_COLOR = '#060606';

/**
 * Colour, grouped Words / Caption box / Canvas.
 *
 * This tab used to morph: stroke appeared only for bold-outline, shadow only
 * for script-accent, because those were the presets declaring the defaults. The
 * renderer never had that restriction — it has always read
 * `style.strokeWidth ?? preset.stroke?.defaultWidth ?? DEFAULT` — so the gate
 * was UI-only, and lifting it makes every style strokeable and shadowable.
 *
 * The trade is that presets read as starting points rather than as fixed looks.
 * That is the intent: with the active-word colours below editable too,
 * cream-block stops being a distinct preset and becomes a chip colour.
 */
export function ColorsTab() {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);

  const preset = getCaptionStylePreset(style.captionStyleId);
  const chipEnabled = style.activeWordBackgroundEnabled ?? true;

  const strokeWidth = style.strokeWidth ?? preset.stroke?.defaultWidth ?? 0;
  const shadowIntensity = style.glowIntensity ?? preset.glow?.defaultIntensity ?? 0;

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
          label="Active word"
          hint="The word being spoken right now"
          value={style.activeWordColor ?? preset.chipTextColor ?? FALLBACK_CHIP_TEXT_COLOR}
          onChange={(activeWordColor) => setStyle({ activeWordColor })}
        />
        <ToggleRow
          surface="bare"
          label="Active word background"
          checked={chipEnabled}
          onChange={(activeWordBackgroundEnabled) => setStyle({ activeWordBackgroundEnabled })}
          adornment={
            <ColorSwatch
              label="Active word background"
              showHex={false}
              value={style.activeWordBackgroundColor ?? preset.chipColor ?? FALLBACK_CHIP_COLOR}
              onChange={(activeWordBackgroundColor) => setStyle({ activeWordBackgroundColor })}
            />
          }
        />
        <ColorRow
          label="Emphasis"
          hint="Words you tapped in Captions"
          value={style.accentColor ?? preset.accentColor ?? FALLBACK_EMPHASIS_COLOR}
          onChange={(accentColor) => setStyle({ accentColor })}
        />
      </div>

      <span className={ordSectionLabel}>Caption box</span>
      <div className="flex flex-col gap-3">
        <ToggleRow
          surface="bare"
          label="Caption background"
          hint="A panel behind the whole block"
          checked={style.captionBackgroundEnabled ?? false}
          onChange={(captionBackgroundEnabled) => setStyle({ captionBackgroundEnabled })}
          adornment={
            <ColorSwatch
              label="Caption background"
              showHex={false}
              value={style.captionBackgroundColor ?? FALLBACK_CAPTION_BG_COLOR}
              onChange={(captionBackgroundColor) =>
                // Turning the colour on implies wanting to see it — otherwise
                // picking a swatch does nothing until you also find the toggle.
                setStyle({ captionBackgroundColor, captionBackgroundEnabled: true })
              }
            />
          }
        />

        <div className={ordFieldCard}>
          <ColorRow
            label="Stroke"
            value={style.strokeColor ?? preset.stroke?.defaultColor ?? FALLBACK_STROKE_COLOR}
            onChange={(strokeColor) => setStyle({ strokeColor })}
          />
          <SliderRow
            label="Stroke width"
            valueLabel={`${Math.round((strokeWidth / MAX_STROKE_WIDTH) * 100)}%`}
            minLabel="None"
            maxLabel="Thick"
            min={0}
            max={MAX_STROKE_WIDTH}
            step={0.5}
            value={strokeWidth}
            onChange={(next) => setStyle({ strokeWidth: next })}
          />
        </div>

        <div className={ordFieldCard}>
          <ColorRow
            label="Shadow"
            value={style.glowColor ?? preset.glow?.defaultColor ?? FALLBACK_SHADOW_COLOR}
            onChange={(glowColor) => setStyle({ glowColor })}
          />
          <SliderRow
            label="Shadow intensity"
            valueLabel={`${Math.round(shadowIntensity * 100)}%`}
            minLabel="None"
            maxLabel="Heavy"
            min={0}
            max={1}
            step={0.05}
            value={shadowIntensity}
            onChange={(next) => setStyle({ glowIntensity: next })}
          />
        </div>
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
