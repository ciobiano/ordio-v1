'use client';

/** Word timing — nudge the selected word until the highlight lands on the beat. */

import type { Word } from '@Ordio/shared';
import { chip } from '@/lib/desk/deskVariants';
import type { DeskState } from '@/lib/desk/deskState';
import { PanelBody, Section } from './InspectorFields';

interface TimingPanelProps {
  state: DeskState;
  words: Word[];
  activeWordIndex: number;
  onNudgeWord: (index: number, deltaSeconds: number) => void;
  onResync: () => void;
}

export function TimingPanel({
  words,
  activeWordIndex,
  onNudgeWord,
  onResync,
}: TimingPanelProps) {
  const word = words[activeWordIndex];

  return (
    <PanelBody>
      <Section
        label="Selected word"
        hint={
          word
            ? undefined
            : 'Scrub the timeline until a word is under the playhead.'
        }
      >
        {word && (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--ord-paper)]/5 p-3">
            <span className="ord-type-title font-bold text-[var(--ord-paper)]">
              {word.text}
            </span>
            <span className="ord-mono">
              {word.start.toFixed(2)}s → {word.end.toFixed(2)}s
            </span>
            <div className="flex gap-2 pt-1">
              {[-0.1, -0.05, 0.05, 0.1].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => onNudgeWord(activeWordIndex, delta)}
                  className={chip({ size: 'sm' })}
                >
                  {delta > 0 ? `+${delta}` : delta}s
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section
        label="Re-sync"
        hint="Runs the whole clip through timing again and discards manual nudges."
      >
        <button type="button" onClick={onResync} className={chip({ size: 'md' })}>
          Re-sync every word
        </button>
      </Section>
    </PanelBody>
  );
}
