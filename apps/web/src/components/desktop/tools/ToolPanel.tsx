'use client';

/**
 * The panel the tool strip opens.
 *
 * Floats to the LEFT of the strip, because the strip is on the right edge and
 * a panel opening rightward would go off the window. It overlays the canvas
 * rather than displacing it — that is what floating buys, and why the resting
 * cost of the tools is the 48px strip alone.
 *
 * The seven panels themselves are unchanged. Only their container moved: this
 * replaces the always-open 372px inspector column, so every field, slider and
 * chip that existed in the docked inspector still exists here.
 */

import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import type { Word } from '@Ordio/shared';
import { iconButton } from '@/lib/variants';
import type { DeskState } from '@/lib/desktop/deskState';
import { TOOL_COPY } from '@/lib/desktop/deskCatalog';
import { AudioPanel } from '../inspector/AudioPanel';
import { DirectorPanel } from '../inspector/DirectorPanel';
import { PresetsPanel } from '../inspector/PresetsPanel';
import { ReframePanel } from '../inspector/ReframePanel';
import { StylePanel } from '../inspector/StylePanel';
import { TimingPanel } from '../inspector/TimingPanel';
import { TrimPanel } from '../inspector/TrimPanel';
import type { FeatureKey } from '@/lib/featureGates';

interface ToolPanelProps {
  state: DeskState;
  words: Word[];
  activeWordIndex: number;
  pauses: { at: number; len: number }[];
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onClose: () => void;
  onNudgeWord: (index: number, deltaSeconds: number) => void;
  onResync: () => void;
  onCutAllPauses: () => void;
  onRemoveFillers: () => void;
  onResetTrim: () => void;
  onApplyTrim: () => void;
  /** Route a gated backdrop to the upgrade sheet, as the phone does. */
  onLocked?: (feature: FeatureKey) => void;
  hasPendingCuts: boolean;
  onReroll: () => void;
}

export function ToolPanel(props: ToolPanelProps) {
  const { state, patch } = props;
  const copy = TOOL_COPY[state.tool];
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape closes. The docked inspector could not support this because it had
     no closed state to escape to. Bound on the panel rather than the window so
     it cannot swallow Escape from a sheet layered above it. */
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        props.onClose();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [props]);

  return (
    <aside
      ref={panelRef}
      className="ord-toolpanel"
      aria-label={copy.title}
      /* Not a dialog: the canvas behind stays live and editable while this is
         open, so trapping focus here would be a lie about what is reachable. */
    >
      <div className="flex flex-none items-start gap-2 px-4 pt-3 pb-2">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="ord-type-subtitle font-bold text-[var(--ord-paper)]">
            {copy.title}
          </span>
          <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
            {copy.hint}
          </span>
        </span>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={`Close ${copy.title}`}
          title="Close · Esc"
          className={iconButton({ tone: 'bare', size: 'sm' })}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} />
        </button>
      </div>

      {state.tool === 'presets' && (
        <PresetsPanel state={state} patch={patch} onLocked={props.onLocked} />
      )}
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
          onApply={props.onApplyTrim}
          hasPendingCuts={props.hasPendingCuts}
        />
      )}
      {state.tool === 'reframe' && <ReframePanel state={state} patch={patch} />}
      {state.tool === 'director' && (
        <DirectorPanel state={state} patch={patch} onReroll={props.onReroll} />
      )}
    </aside>
  );
}
