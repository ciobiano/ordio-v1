'use client';

/** The right column: tool title, hint, and whichever panel the rail selected. */

import type { Word } from '@Ordio/shared';
import type { DeskState } from '@/lib/desk/deskState';
import { TOOL_COPY } from '@/lib/desk/deskCatalog';
import { StylePanel } from './StylePanel';
import { TimingPanel } from './TimingPanel';
import { AudioPanel } from './AudioPanel';
import { TrimPanel } from './TrimPanel';
import { ReframePanel } from './ReframePanel';
import { DirectorPanel } from './DirectorPanel';

interface InspectorPanelProps {
  state: DeskState;
  words: Word[];
  activeWordIndex: number;
  pauses: { at: number; len: number }[];
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onNudgeWord: (index: number, deltaSeconds: number) => void;
  onResync: () => void;
  onCutAllPauses: () => void;
  onRemoveFillers: () => void;
  onResetTrim: () => void;
  onReroll: () => void;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { state, patch } = props;
  const copy = TOOL_COPY[state.tool];

  return (
    <aside className="ord-inspector" aria-label={copy.title}>
      <div className="flex flex-none flex-col gap-[3px] px-[18px] pt-3.5 pb-2.5">
        <span className="text-base font-bold tracking-[-0.01em] text-[var(--ord-paper)]">
          {copy.title}
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          {copy.hint}
        </span>
      </div>

      {state.tool === 'style' && <StylePanel state={state} patch={patch} />}
      {state.tool === 'timing' && (
        <TimingPanel
          state={state}
          words={props.words}
          activeWordIndex={props.activeWordIndex}
          onNudgeWord={props.onNudgeWord}
          onResync={props.onResync}
        />
      )}
      {state.tool === 'audio' && <AudioPanel state={state} patch={patch} />}
      {state.tool === 'trim' && (
        <TrimPanel
          state={state}
          pauses={props.pauses}
          patch={patch}
          onCutAllPauses={props.onCutAllPauses}
          onRemoveFillers={props.onRemoveFillers}
          onReset={props.onResetTrim}
        />
      )}
      {state.tool === 'reframe' && <ReframePanel state={state} patch={patch} />}
      {state.tool === 'director' && (
        <DirectorPanel state={state} patch={patch} onReroll={props.onReroll} />
      )}
    </aside>
  );
}
