'use client';

/** Trim handles, detected pauses, and the two bulk cuts. */

import { chip } from '@/lib/variants';
import type { DeskState } from '@/lib/desktop/deskState';
import { PanelBody, Section, SliderField } from './InspectorFields';

interface TrimPanelProps {
  state: DeskState;
  pauses: { at: number; len: number }[];
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onCutAllPauses: () => void;
  onRemoveFillers: () => void;
  onReset: () => void;
  /** Cut the audio and transcript for real. Destructive, hence a button. */
  onApply: () => void;
  /** Whether the handles currently describe a cut worth applying. */
  hasPendingCuts: boolean;
}

export function TrimPanel({
  state,
  pauses,
  patch,
  onCutAllPauses,
  onRemoveFillers,
  onReset,
  onApply,
  hasPendingCuts,
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

      {/* Everything above this is pending. Dragging a handle moves a marker;
          nothing is removed from the audio until Apply, which is what lets you
          browse a cut before committing to it. The phone works the same way,
          and the desk previously had neither the button nor the commit behind
          it — the handles wrote two numbers that only shaded the timeline. */}
      <Section
        label="Commit"
        hint={
          hasPendingCuts
            ? 'Rewrites the audio and the transcript together. Undo brings it back.'
            : 'Move a handle or pick a pause to cut.'
        }
      >
        <button
          type="button"
          onClick={onApply}
          disabled={!hasPendingCuts}
          className={chip({ size: 'md', selected: hasPendingCuts })}
        >
          Apply cuts
        </button>
      </Section>
    </PanelBody>
  );
}
