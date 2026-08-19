'use client';

/** Three looks built from this clip, plus a reroll. */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/desk/deskVariants';
import { LOOKS, PRESETS } from '@/lib/desk/deskCatalog';
import type { DeskState } from '@/lib/desk/deskState';
import { PanelBody, Section } from './InspectorFields';

interface DirectorPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onReroll: () => void;
}

export function DirectorPanel({ state, patch, onReroll }: DirectorPanelProps) {
  return (
    <PanelBody>
      <Section label="Looks">
        <div className="flex flex-col gap-1.5">
          {LOOKS.map((look) => {
            const preset = PRESETS.find((p) => p.id === look.preset);
            const isActive = state.preset === look.preset && state.artwork === look.comp;

            return (
              <button
                key={look.name}
                type="button"
                onClick={() =>
                  preset &&
                  patch(
                    {
                      artwork: look.comp,
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
                  'flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors',
                  isActive
                    ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                    : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                )}
              >
                <span className="ord-type-label font-bold text-[var(--ord-paper)]">
                  {look.name}
                </span>
                <span className="font-[family-name:var(--font-display)] ord-type-footnote leading-[1.35] text-[var(--text-muted)]">
                  {look.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Not feeling it">
        <button type="button" onClick={onReroll} className={chip({ size: 'md' })}>
          Reroll the three
        </button>
      </Section>
    </PanelBody>
  );
}
