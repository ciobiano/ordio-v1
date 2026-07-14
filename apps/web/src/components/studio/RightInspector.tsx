'use client';

import StyleControls from '@/components/soul/captions/StyleControls';
import { studioCard } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
import type { FeatureKey } from '@/lib/featureGates';

interface RightInspectorProps {
  view: StudioView;
  audioLevel: number;
  onLocked: (feature: FeatureKey) => void;
}

export function RightInspector({ view, audioLevel, onLocked }: RightInspectorProps) {
  return (
    <div className="w-80 flex-none bg-acid-bg-subtle border-l border-acid-border-subtle overflow-y-auto p-4 flex flex-col gap-3.5 min-h-0">
      {view === 'idle' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Input</div>
          <div className={studioCard()}>
            <div>
              <div className="text-[11px] text-acid-text-3 uppercase tracking-wide mb-1.5">Microphone</div>
              <div className="flex items-center justify-between text-[13.5px] text-acid-text-1 font-bold">
                System default <span className="text-acid-text-3">▾</span>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'capture' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Listening</div>
          <div className={studioCard()}>
            <div className="flex items-center gap-2 text-acid-text-1 text-xs font-bold">
              <span className="w-1.75 h-1.75 rounded-full bg-acid-text-1 animate-pulse" />
              Clean signal
            </div>
            <div className="flex gap-1 h-10 items-end" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 flex-none bg-acid-text-1 rounded"
                  style={{ height: `${20 + audioLevel * 60 + i}%` }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'processing' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Transcription</div>
          <div className={studioCard() + ' text-xs text-acid-text-3'}>
            <div className="flex justify-between">
              Model<span className="text-acid-text-1 font-bold">Ordio Whisper-XL</span>
            </div>
          </div>
        </>
      )}

      {view === 'edit' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Caption Style</div>
          <StyleControls onLocked={onLocked} />
          <div className="font-acid-display font-semibold text-sm text-acid-text-1 mt-1">Background</div>
          <div className={studioCard() + ' text-xs text-acid-text-3'}>
            Background picker ships once video-backgrounds lands on this branch.
          </div>
        </>
      )}
    </div>
  );
}
