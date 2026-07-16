'use client';

import StyleControls from '@/components/soul/captions/StyleControls';
import FormatToggle from '@/components/soul/shared/FormatToggle';
import AudioSettings from '@/components/soul/recording/AudioSettings';
import { TrimPanel } from '@/components/soul/editor/TrimPanel';
import { studioCard } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
import type { UseMicDevicesReturn } from '@/hooks/studio/useMicDevices';
import type { UseStudioEditsReturn } from '@/hooks/studio/useStudioEdits';
import type { FeatureKey } from '@/lib/featureGates';

interface RightInspectorProps {
  view: StudioView;
  audioLevel: number;
  mics: UseMicDevicesReturn;
  edits: UseStudioEditsReturn;
  audioBuffer: AudioBuffer | null;
  onPreviewAt: (time: number) => void;
  onLocked: (feature: FeatureKey) => void;
}

function MicPicker({ mics }: { mics: UseMicDevicesReturn }) {
  return (
    <div className={studioCard()}>
      <div>
        <label
          htmlFor="studio-mic-select"
          className="block text-[11px] text-acid-text-3 uppercase tracking-wide mb-1.5"
        >
          Microphone
        </label>
        <select
          id="studio-mic-select"
          value={mics.selectedDeviceId ?? ''}
          onChange={(e) => mics.selectDevice(e.target.value || undefined)}
          className="w-full bg-acid-surface-2 border border-acid-border-subtle rounded-acid-sm text-[13.5px] text-acid-text-1 font-bold px-2.5 py-2 outline-none cursor-pointer focus:border-acid-border-strong"
        >
          <option value="">System default</option>
          {mics.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        {mics.devices.length === 0 && (
          <div className="text-[11px] text-acid-text-3 mt-1.5">
            External mics appear here when the system detects them.
          </div>
        )}
      </div>
    </div>
  );
}

export function RightInspector({
  view,
  audioLevel,
  mics,
  edits,
  audioBuffer,
  onPreviewAt,
  onLocked,
}: RightInspectorProps) {
  return (
    <div className="w-80 flex-none bg-acid-bg-subtle border-l border-acid-border-subtle overflow-y-auto p-4 flex flex-col gap-3.5 min-h-0">
      {view === 'idle' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Input</div>
          <MicPicker mics={mics} />
          <div className="font-acid-display font-semibold text-sm text-acid-text-1 mt-1">
            Audio quality
          </div>
          <div className={studioCard()}>
            <AudioSettings onLocked={onLocked} />
          </div>
        </>
      )}

      {view === 'capture' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Listening</div>
          <div className={studioCard()}>
            <div className="flex items-center gap-2 text-acid-text-1 text-xs font-bold">
              <span className="w-1.75 h-1.75 rounded-full bg-acid-text-1 animate-pulse" />
              {audioLevel > 0.02 ? 'Clean signal' : 'Waiting for sound…'}
            </div>
            <div className="flex gap-1 h-10 items-end" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 flex-none bg-acid-text-1 rounded"
                  style={{ height: `${Math.min(100, 12 + audioLevel * 88 * ((i % 5) / 4 + 0.6))}%` }}
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

      {(view === 'edit' || view === 'export') && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Trim</div>
          <div className={studioCard()}>
            <TrimPanel
              audioBuffer={audioBuffer}
              trimmer={edits.trimmer}
              onCommit={edits.commit}
              onUndo={edits.undo}
              onRedo={edits.redo}
              canUndo={edits.canUndo}
              canRedo={edits.canRedo}
              onPreviewAt={onPreviewAt}
            />
            <button
              type="button"
              onClick={edits.markFillerWords}
              className="h-8 rounded-acid-sm bg-acid-surface-2 border border-acid-border-subtle text-xs font-bold text-acid-text-2 hover:text-acid-text-1"
            >
              Remove filler words
            </button>
          </div>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1 mt-1">Format</div>
          <FormatToggle onLocked={onLocked} />
          <div className="font-acid-display font-semibold text-sm text-acid-text-1 mt-1">
            Caption Style
          </div>
          <StyleControls onLocked={onLocked} />
        </>
      )}
    </div>
  );
}
