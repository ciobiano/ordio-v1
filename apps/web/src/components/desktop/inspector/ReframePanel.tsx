'use client';

/** Ratio, fit, and the safe zone you post into. */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/desktop/deskVariants';
import type { DeskState } from '@/lib/desktop/deskState';
import { FORMATS, SAFE, type SafeId } from '@/lib/desktop/deskCatalog';
import { ChipRow, PanelBody, Section } from './InspectorFields';

interface ReframePanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>) => void;
}

export function ReframePanel({ state, patch }: ReframePanelProps) {
  return (
    <PanelBody>
      <Section label="Aspect ratio">
        <div className="flex gap-2">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => patch({ format: format.id })}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border py-2 transition-colors duration-[var(--dur-tap)]',
                state.format === format.id
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
              )}
            >
              <span
                className="block rounded-full bg-[var(--text-body)]"
                style={{ width: format.w, height: format.h }}
              />
              <span className="ord-mono">{format.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Content fit">
        <ChipRow
          options={[
            { id: 'fill', label: 'Fill' },
            { id: 'fit', label: 'Fit' },
          ]}
          value={state.fit}
          onChange={(id) => patch({ fit: id })}
        />
      </Section>

      <Section label="Safe zones">
        <ChipRow
          options={(Object.keys(SAFE) as SafeId[]).map((id) => ({
            id,
            label: SAFE[id].label,
          }))}
          value={state.safe}
          onChange={(id) => patch({ safe: id, safeShow: id !== 'none' })}
        />
      </Section>
    </PanelBody>
  );
}
