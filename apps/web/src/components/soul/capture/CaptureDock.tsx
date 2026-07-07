'use client';

import { Upload, Settings, Stop, Pause, Play, Refresh, Close } from 'griddy-icons';
import { cn } from '@/lib/utils';
import { captureCenterSlot, capturePillBar, captureRecordBtn, captureRoundBtn } from '@/lib/variants';
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
  onRestart: () => void;
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
    return (
      <div className="absolute left-0 right-0 bottom-0 px-5 pb-6.5 z-20">
        <div className="flex items-center gap-3 w-full min-h-15">
          <button type="button" onClick={onOpenUpload} className={capturePillBar} aria-label="Upload audio or video">
            <Upload size={20} className="shrink-0 text-black/55" />
            <span className="truncate">Upload audio or video</span>
          </button>
          <button
            type="button"
            onPointerDown={onRecordPressStart}
            onPointerUp={onRecordPressEnd}
            onPointerLeave={onRecordPressEnd}
            className={captureRecordBtn}
            aria-label="Press and hold to record"
          >
            <span className="w-4.5 h-4.5 rounded-full bg-[#ff453a]" />
          </button>
          <button type="button" onClick={onOpenSettings} className={captureRoundBtn({ tone: 'neutral' })} aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </div>
    );
  }

  const isRecPaused = phase === 'recording' || phase === 'paused';
  const isReady = phase === 'ready';
  const isProcessing = phase === 'processing';

  return (
    <div className="absolute left-0 right-0 bottom-0 px-5 pb-6.5 z-20">
      <div className="flex items-center gap-3 w-full min-h-15">
        <button
          type="button"
          onClick={isRecPaused ? onGoReady : onOpenSettings}
          className={captureRoundBtn({ tone: isRecPaused ? 'dark' : 'neutral' })}
          aria-label={isRecPaused ? 'Stop and review recording' : 'Settings'}
        >
          {isRecPaused ? <Stop size={20} /> : <Settings size={20} />}
        </button>

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
          <button
            type="button"
            onClick={phase === 'recording' ? onPause : phase === 'paused' ? onResume : onRestart}
            className={captureRoundBtn({ tone: 'danger' })}
            aria-label={phase === 'recording' ? 'Pause recording' : phase === 'paused' ? 'Resume recording' : 'Restart recording'}
          >
            {phase === 'recording' && <Pause size={18} />}
            {phase === 'paused' && <Play size={18} />}
            {isReady && <Refresh size={18} />}
          </button>
        )}

        <button type="button" onClick={onCancel} className={captureRoundBtn({ tone: 'neutral' })} aria-label="Cancel">
          <Close size={18} />
        </button>
      </div>
    </div>
  );
}
