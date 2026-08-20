'use client';

/** Trim handles, detected pauses, and the two bulk cuts. */

import { chip } from '@/lib/desktop/deskVariants';
import type { DeskState } from '@/lib/desktop/deskState';
import { PanelBody, Section, SliderField } from './InspectorFields';

interface TrimPanelProps {
  state: DeskState;
  pauses: { at: number; len: number }[];
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onCutAllPauses: () => void;
  onRemoveFillers: () => void;
  onReset: () => void;
}

export function TrimPanel({
  state,
  pauses,
  patch,
  onCutAllPauses,
  onRemoveFillers,
  onReset,
}: TrimPanelProps) {
  return (
    <PanelBody>
      <Section label="Handles">
        <SliderField
          label="In"
          value={state.trimIn}
          readout={`${state.trimIn.toFixed(1)}s`}
          min={0}
          max={Math.max(0, state.duration - state.trimOut - 1)}
          step={0.1}
          onChange={(v) => patch({ trimIn: v }, true)}
        />
        <SliderField
          label="Out"
          value={state.trimOut}
          readout={`${state.trimOut.toFixed(1)}s`}
          min={0}
          max={Math.max(0, state.duration - state.trimIn - 1)}
          step={0.1}
          onChange={(v) => patch({ trimOut: v }, true)}
        />
      </Section>

      <Section
        label="Detected pauses"
        hint={pauses.length ? 'Click to cut' : 'No long pauses in this clip.'}
      >
        <div className="flex flex-wrap gap-2">
          {pauses.map((pause) => (
            <button
              key={pause.at}
              type="button"
              onClick={() =>
                patch(
                  {
                    cutPauses: state.cutPauses.includes(pause.at)
                      ? state.cutPauses.filter((p) => p !== pause.at)
                      : [...state.cutPauses, pause.at],
                  },
                  true
                )
              }
              className={chip({
                selected: state.cutPauses.includes(pause.at),
                size: 'sm',
              })}
            >
              {pause.at.toFixed(1)}s · {pause.len.toFixed(1)}s
            </button>
          ))}
        </div>
      </Section>

      <Section label="Bulk">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCutAllPauses} className={chip({ size: 'md' })}>
            Cut every pause
          </button>
          <button type="button" onClick={onRemoveFillers} className={chip({ size: 'md' })}>
            Remove filler words
          </button>
          <button type="button" onClick={onReset} className={chip({ size: 'md' })}>
            Reset
          </button>
        </div>
      </Section>
    </PanelBody>
  );
}
