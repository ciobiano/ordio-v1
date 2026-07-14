'use client';

import { PromptBar } from './PromptBar';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import { Orb } from '@/components/primitives/orb/Orb';
import { useUIStore } from '@/stores';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

export interface SessionEditData {
  sessionId: string;
}

interface CenterStageProps {
  flow: UseStudioFlowReturn;
  sessionData: SessionEditData | null;
  audioLevel: number;
  playback: UsePlaybackReturn;
}

function formatTimer(seconds: number): string {
  const t = Math.floor(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function CenterStage({ flow, sessionData, audioLevel, playback }: CenterStageProps) {
  const format = useUIStore((s) => s.format);
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const captionMode = useUIStore((s) => s.captionMode);

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center min-w-0 bg-[radial-gradient(120%_90%_at_50%_0%,var(--acid-bg-subtle)_0%,var(--acid-bg-base)_60%)] p-7">
      {flow.view === 'idle' && (
        <div className="flex flex-col items-center gap-8.5">
          <div className="text-center">
            <div className="font-acid-display font-semibold text-[46px] leading-[1.02] text-acid-text-1 tracking-tight">
              What are we making
              <br />
              today?
            </div>
            <div className="text-[15px] text-acid-text-3 mt-3.5">
              Tap the orb to record, drop a file anywhere, or press ⌘K.
            </div>
          </div>
          <Orb
            state="dormant"
            intensity={0}
            onClick={flow.isStarting ? undefined : () => void flow.startRecording()}
            ariaLabel="Tap to record"
          />
          {flow.micDenied && (
            <div className="text-xs text-acid-error">Microphone access denied — check browser settings.</div>
          )}
        </div>
      )}

      {flow.view === 'capture' && (
        <div className="w-full max-w-160 flex flex-col items-center gap-7.5">
          <div className="flex items-center gap-2.5 text-acid-text-1 font-bold text-[13px] uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-acid-error animate-pulse" />
            Recording{' '}
            <span className="text-acid-text-3 tabular-nums normal-case tracking-normal">
              {formatTimer(flow.recordingTime)}
            </span>
          </div>
          <div className="w-full h-37.5 flex items-center justify-center gap-0.5" aria-hidden="true">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded bg-acid-text-1/70"
                style={{ height: `${20 + Math.abs(Math.sin(i * 0.7 + audioLevel * 10)) * 70}%` }}
              />
            ))}
          </div>
          <button
            aria-label="Stop recording"
            onClick={() => void flow.stopRecording()}
            className="w-16 h-16 rounded-full border-3 border-acid-border-default flex items-center justify-center"
          >
            <div className="w-5.5 h-5.5 rounded-md bg-acid-error" />
          </button>
        </div>
      )}

      {flow.view === 'processing' && (
        <div className="w-full max-w-165 flex flex-col items-center gap-5.5">
          <div className="flex items-center gap-3.5">
            <div
              className="w-13 h-13 rounded-full"
              style={{
                background: `conic-gradient(var(--acid-text-1) ${flow.processingProgress * 3.6}deg, var(--acid-surface-2) 0deg)`,
              }}
            />
            <div>
              <div className="font-acid-display font-semibold text-[19px] text-acid-text-1">
                Transcribing your clip…
              </div>
              <div className="text-xs text-acid-text-3 mt-0.5">
                {Math.round(flow.processingProgress)}% · you can keep recording, this won&apos;t block you
              </div>
            </div>
          </div>
          <button
            onClick={flow.cancelProcessing}
            className="h-8.5 px-4 rounded-acid-sm border border-acid-border-default text-acid-text-2 text-xs font-bold hover:text-acid-text-1 hover:border-acid-border-strong"
          >
            Cancel
          </button>
        </div>
      )}

      {flow.view === 'edit' && sessionData && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-67.5 h-120 rounded-acid-lg overflow-hidden border border-acid-border-default shadow-2xl">
            <CanvasPreview
              playback={playback}
              format={format}
              waveformStyle={waveformStyle}
              captionMode={captionMode}
            />
          </div>
        </div>
      )}

      <PromptBar
        visible={flow.view === 'idle' || flow.view === 'edit'}
        placeholder={flow.view === 'edit' ? 'remove all the ums' : 'record, drop, or ask anything…'}
      />
    </div>
  );
}
