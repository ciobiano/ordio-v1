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
import type { DeskState } from '@/lib/desk/deskState';
import { PRESETS } from '@/lib/desk/deskCatalog';
import { PanelBody, Section } from './InspectorFields';

interface PresetsPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
}

export function PresetsPanel({ state, patch }: PresetsPanelProps) {
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
                'flex flex-col items-center justify-center gap-1 rounded-xl border py-3 transition-colors duration-[var(--dur-tap)]',
                state.preset === preset.id
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
              )}
            >
              <span className="ord-type-footnote font-semibold text-[var(--ord-paper)]">
                {preset.name}
              </span>
              <span
                className="ord-mono ord-type-micro"
                style={{ fontFamily: `'${preset.font}', sans-serif` }}
              >
                {preset.sample}
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
