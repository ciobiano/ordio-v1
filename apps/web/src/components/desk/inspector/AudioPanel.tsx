'use client';

/** Voice level, normalisation, and the bed underneath. */

import type { DeskState } from '@/lib/desk/deskState';
import { BEDS } from '@/lib/desk/deskCatalog';
import {
  ChipRow,
  PanelBody,
  Section,
  SliderField,
  ToggleField,
} from './InspectorFields';

interface AudioPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>) => void;
}

export function AudioPanel({ state, patch }: AudioPanelProps) {
  return (
    <PanelBody>
      <Section label="Voice">
        <SliderField
          label="Voice level"
          value={state.voiceLevel}
          readout={`${state.voiceLevel}%`}
          min={0}
          max={140}
          onChange={(v) => patch({ voiceLevel: v })}
        />
        <ToggleField
          label="Level out the voice"
          hint="Quiet parts come up, peaks come down"
          checked={state.normalize}
          onChange={(v) => patch({ normalize: v })}
        />
      </Section>

      <Section label="Music bed">
        <ChipRow
          options={BEDS.map((b) => ({ id: b.id, label: b.label }))}
          value={state.bed}
          onChange={(id) => patch({ bed: id })}
        />
        {state.bed !== 'none' && (
          <>
            <SliderField
              label="Music level"
              value={state.musicLevel}
              readout={`${state.musicLevel}%`}
              min={0}
              max={100}
              onChange={(v) => patch({ musicLevel: v })}
            />
            <ToggleField
              label="Duck under the voice"
              checked={state.duck}
              onChange={(v) => patch({ duck: v })}
            />
          </>
        )}
      </Section>
    </PanelBody>
  );
}
