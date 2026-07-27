'use client';

import { Upload, Settings, Stop, Pause, Play, Refresh, Close, Microphone } from 'griddy-icons';
import { cn } from '@/lib/utils';
import { captureCenterSlot, captureRecordHero, captureRoundBtn } from '@/lib/variants';
import type { CapturePhase } from './types';

interface CaptureDockProps {
  phase: CapturePhase;
  progress: number;
  onOpenUpload: () => void;
  onRecordPressStart: () => void;
  onRecordPressEnd: () => void;
  onOpenSettings: () => void;
  onGoReady: () => void;
  onProcess: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Caller is expected to confirm before this fires — it discards the current take. */
  onRestart: () => void;
  /** Caller is expected to confirm before this fires — it discards the current take. */
  onCancel: () => void;
}

const WAVE_HEIGHTS = [0.42, 0.75, 1, 0.6, 0.34];

export function CaptureDock({
  phase,
  progress,
  onOpenUpload,
  onRecordPressStart,
  onRecordPressEnd,
  onOpenSettings,
  onGoReady,
  onProcess,
  onPause,
  onResume,
  onRestart,
  onCancel,
}: CaptureDockProps) {
  if (phase === 'idle') {
    // Camera-app dock: record is the centered hero, upload/settings flank it as
    // labeled icon buttons. (The old full-width "Upload audio or video" pill
    // read as a search field next to mobile browsers' URL bars.)
    return (
      <div className="absolute left-0 right-0 bottom-0 px-5 pb-10 z-20">
        <div className="flex items-end justify-center gap-10 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenUpload}
              className={captureRoundBtn({ tone: 'neutral' })}
              aria-label="Upload audio or video"
            >
              <Upload size={18} />
            </button>
            <span className="text-[11px] text-white/40" aria-hidden="true">Upload</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onPointerDown={onRecordPressStart}
              onPointerUp={onRecordPressEnd}
              onPointerLeave={onRecordPressEnd}
              className={captureRecordHero}
              aria-label="Press to record"
            >
              <Microphone size={26} />
            </button>
            <span className="text-[11px] text-white/60" aria-hidden="true">Record</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className={captureRoundBtn({ tone: 'neutral' })}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <span className="text-[11px] text-white/40" aria-hidden="true">Settings</span>
          </div>
        </div>
      </div>
    );
  }

  const isRecPaused = phase === 'recording' || phase === 'paused';
  const isReady = phase === 'ready';
  const isProcessing = phase === 'processing';

  return (
    <div className="absolute left-0 right-0 bottom-0 px-5 pb-10 z-20">
      <div className="flex items-end gap-3 w-full min-h-15">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={isRecPaused ? onGoReady : onOpenSettings}
            className={captureRoundBtn({ tone: isRecPaused ? 'primary' : 'neutral' })}
            aria-label={isRecPaused ? 'Stop and review recording' : 'Settings'}
          >
            {isRecPaused ? <Stop size={20} /> : <Settings size={20} />}
          </button>
          <span className="text-[11px] text-white/40" aria-hidden="true">
            {isRecPaused ? 'Stop' : 'Settings'}
          </span>
        </div>

        <button
          type="button"
          onClick={isReady ? onProcess : undefined}
          className={cn(
            captureCenterSlot({ phase: isRecPaused ? 'recordPaused' : isReady ? 'ready' : 'processing' })
          )}
          aria-label={isReady ? 'Process recording' : undefined}
          disabled={!isReady}
        >
          {isRecPaused && (
            <div className="flex items-center justify-center gap-1.5 w-full h-full">
              {WAVE_HEIGHTS.map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-[3px] bg-[#1c1c1e]"
                  style={{
                    height: `${18 + h * 24}px`,
                    transform: phase === 'paused' ? `scaleY(${0.4 + h * 0.4})` : undefined,
                    animation:
                      phase === 'recording'
                        ? `waveEq ${700 + i * 90}ms ease-in-out ${i * 90}ms infinite`
                        : undefined,
                  }}
                />
              ))}
            </div>
          )}
          {isReady && <span className="text-black font-semibold text-base whitespace-nowrap">Process recording</span>}
          {isProcessing && (
            <span
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-[width] duration-120 ease-linear"
              style={{ width: `${Math.round(progress)}%` }}
            />
          )}
        </button>

        {!isProcessing && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={phase === 'recording' ? onPause : phase === 'paused' ? onResume : onRestart}
              className={captureRoundBtn({
                tone: phase === 'recording' ? 'warning' : phase === 'paused' ? 'success' : 'danger',
              })}
              aria-label={phase === 'recording' ? 'Pause recording' : phase === 'paused' ? 'Resume recording' : 'Restart recording'}
            >
              {phase === 'recording' && <Pause size={18} />}
              {phase === 'paused' && <Play size={18} />}
              {isReady && <Refresh size={18} />}
            </button>
            <span className="text-[11px] text-white/40" aria-hidden="true">
              {phase === 'recording' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Restart'}
            </span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className={captureRoundBtn({ tone: 'neutral' })}
            aria-label="Cancel"
          >
            <Close size={18} />
          </button>
          <span className="text-[11px] text-white/40" aria-hidden="true">Cancel</span>
        </div>
      </div>
    </div>
  );
}
