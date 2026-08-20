'use client';

/**
 * Presets — a whole look in one tap.
 *
 * Its own category rather than a row inside Style, for two reasons. A preset
 * writes font, capitalisation, text colour, both active-word colours, stroke
 * and animation, which is every tab in the Style panel — it was never a Style
 * setting. And this is where imported artwork and video will land, which is a
 * different kind of thing again from a slider.
 */

import { cn } from '@/lib/utils';
import type { DeskState } from '@/lib/desktop/deskState';
import { PRESETS } from '@/lib/desktop/deskCatalog';
import { useDeskFonts } from '@/lib/desktop/useDeskFonts';
import { PanelBody, Section } from './InspectorFields';

/**
 * What the preset actually looks like, drawn from the same fields the tile
 * applies — face, colour, capitalisation, stroke, and the active-word chip.
 *
 * Not a thumbnail. A stored image would be a second source of truth that goes
 * stale the moment a preset's colour changes, and there are no such images in
 * the repo to begin with. Rendering from the preset means the tile cannot
 * disagree with the result.
 */
function PresetPreview({ preset }: { preset: (typeof PRESETS)[number] }) {
  const words = preset.sample.split(' ');
  const lead = words.slice(0, -1).join(' ');
  const last = words[words.length - 1];

  return (
    <span
      aria-hidden="true"
      className="flex h-[46px] w-full items-center justify-center gap-1 overflow-hidden rounded-md bg-[var(--ord-ink)] px-2"
      style={{
        fontFamily: `'${preset.font}', sans-serif`,
        textTransform: preset.textCase === 'none' ? 'none' : preset.textCase,
        color: preset.text,
        WebkitTextStroke: preset.stroke ? `${preset.stroke / 3}px #0a0b0a` : undefined,
      }}
    >
      {lead && <span className="ord-type-footnote font-bold">{lead}</span>}
      {/* The last word wears the active-word chip, so one tile shows both the
          resting treatment and the highlight it will animate to. */}
      <span
        className="rounded-md px-1 ord-type-footnote font-bold"
        style={{ background: preset.wordBg, color: preset.wordText }}
      >
        {last}
      </span>
    </span>
  );
}

interface PresetsPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
}

export function PresetsPanel({ state, patch }: PresetsPanelProps) {
  // Without this every tile renders in the fallback face and the previews are
  // a lie — see useDeskFonts.
  useDeskFonts(PRESETS.map((p) => p.font));

  return (
    <PanelBody>
      <Section
        label="Caption presets"
        hint="Sets type, colour and motion together. Every one stays editable afterwards."
      >
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.name}
              onClick={() =>
                patch(
                  {
                    preset: preset.id,
                    font: preset.font,
                    capCase: preset.textCase,
                    textColor: preset.text,
                    activeWordBg: preset.wordBg,
                    activeWordColor: preset.wordText,
                    strokeW: preset.stroke,
                    anim: preset.anim,
                  },
                  true
                )
              }
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2 transition-colors duration-[var(--dur-tap)]',
                state.preset === preset.id
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
              )}
            >
              <PresetPreview preset={preset} />
              <span className="ord-type-footnote font-semibold text-[var(--ord-paper)]">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* The slot this category exists to grow into. Named rather than hidden,
          so the shape of what is coming is visible now. */}
      <Section label="Artwork" hint="Bring your own background — coming next.">
        <div className="rounded-xl border border-dashed border-[var(--border-hairline)] px-3 py-4 text-center">
          <span className="ord-type-footnote text-[var(--text-muted)]">
            Image and video import lands here
          </span>
        </div>
      </Section>
    </PanelBody>
  );
}
