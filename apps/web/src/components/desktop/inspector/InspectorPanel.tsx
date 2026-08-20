'use client';

/** The right column: tool title, hint, and whichever panel the rail selected. */

import type { Word } from '@Ordio/shared';
import type { DeskState } from '@/lib/desktop/deskState';
import { TOOL_COPY } from '@/lib/desktop/deskCatalog';
import { CollapseButton, CollapsedStrip } from '../PanelCollapse';
import { PresetsPanel } from './PresetsPanel';
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
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { state, patch } = props;
  const copy = TOOL_COPY[state.tool];

  if (props.collapsed) {
    /* Labelled with the tool, not "Inspector" — the rail stays visible while
       this is shut, so the strip should say which panel is waiting behind it. */
    return (
      <aside className="ord-inspector is-collapsed" aria-label={copy.title}>
        <CollapsedStrip
          side="right"
          label={copy.title}
          onExpand={props.onToggleCollapse}
        />
      </aside>
    );
  }

  return (
    <aside className="ord-inspector" aria-label={copy.title}>
      <div className="flex flex-none flex-col gap-1 px-4 pt-3 pb-2">
        <span className="flex items-start justify-between gap-2 ord-type-subtitle font-bold text-[var(--ord-paper)]">
          {copy.title}
          <CollapseButton
            side="right"
            label="Hide panel"
            onClick={props.onToggleCollapse}
          />
        </span>
        <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
          {copy.hint}
        </span>
      </div>

      {state.tool === 'presets' && <PresetsPanel state={state} patch={patch} />}
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
