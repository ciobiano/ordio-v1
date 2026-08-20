'use client';

/** Voice level, and the sound sitting under it. */

import type { DeskState } from '@/lib/desktop/deskState';
import { bedDuration } from '@/lib/audio/bedGeometry';
import { PanelBody, Section, SliderField, ToggleField } from './InspectorFields';

interface AudioPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>) => void;
}

export function AudioPanel({ state, patch }: AudioPanelProps) {
  const bed = state.bed;

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

      {/* The four named beds that used to sit here — lofi, pulse, warm,
          upload — had no audio behind any of them. Music arrives by being
          dropped on the timeline now, so this panel mixes what is there
          rather than offering a choice that did nothing. */}
      <Section
        label="Music"
        hint={
          bed
            ? undefined
            : 'Drop a sound onto the Music track to add one. Trim it there to the part you want.'
        }
      >
        {bed && (
          <>
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--ord-paper)]/5 p-3">
              <span className="truncate ord-type-label font-semibold text-[var(--ord-paper)]">
                {bed.name}
              </span>
              <span className="ord-mono">
                {bedDuration(bed).toFixed(1)}s at {bed.startAt.toFixed(1)}s
                {bed.trimIn + bed.trimOut > 0 &&
                  ` · ${(bed.trimIn + bed.trimOut).toFixed(1)}s trimmed`}
              </span>
            </div>

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
              hint="Drops the music while you are speaking, using the word timings"
              checked={state.duck}
              onChange={(v) => patch({ duck: v })}
            />
          </>
        )}
      </Section>
    </PanelBody>
  );
}
