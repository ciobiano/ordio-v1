'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Upload01Icon,
  Settings01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Cancel01Icon,
  Mic01Icon,
} from '@hugeicons/core-free-icons';
import { captureCommitPill, captureRecordHero, captureRoundBtn, captureStopHero } from '@/lib/variants';
import type { ReactNode } from 'react';
import type { CapturePhase } from '@/lib/capture/types';

interface CaptureDockProps {
  phase: CapturePhase;
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

export function CaptureDock({
  phase,
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
      <div className="relative z-20 shrink-0 px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] short:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-center gap-10 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenUpload}
              className={captureRoundBtn({ tone: 'neutral', size: 'lg' })}
              aria-label="Upload audio or video"
            >
              <HugeiconsIcon icon={Upload01Icon} size={18} strokeWidth={2} />
            </button>
            <span className="text-acid-footnote text-white/40" aria-hidden="true">Upload</span>
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
              <HugeiconsIcon icon={Mic01Icon} size={26} strokeWidth={2} />
            </button>
            <span className="text-acid-footnote text-white/60" aria-hidden="true">Record</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className={captureRoundBtn({ tone: 'neutral', size: 'lg' })}
              aria-label="Settings"
            >
              <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={2} />
            </button>
            <span className="text-acid-footnote text-white/40" aria-hidden="true">Settings</span>
          </div>
        </div>
      </div>
    );
  }

  const dockClass = 'relative z-20 shrink-0 px-5 pt-5 safe-pb-dock short:pt-3';

  if (phase === 'processing') {
    return (
      <div className={dockClass}>
        <div className="flex justify-center">
          <DockSlot label="Cancel">
            <button type="button" onClick={onCancel} className={captureRoundBtn({ size: 'lg' })} aria-label="Cancel processing">
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
            </button>
          </DockSlot>
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className={dockClass}>
        <div className="flex items-start gap-4">
          <DockSlot label="Restart">
            <button type="button" onClick={onRestart} className={captureRoundBtn({ size: 'lg' })} aria-label="Restart recording">
              <HugeiconsIcon icon={RefreshIcon} size={20} strokeWidth={2} />
            </button>
          </DockSlot>
          <button type="button" onClick={onProcess} className={captureCommitPill}>
            Process recording
          </button>
          <DockSlot label="Discard">
            <button type="button" onClick={onCancel} className={captureRoundBtn({ size: 'lg' })} aria-label="Discard recording">
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
            </button>
          </DockSlot>
        </div>
      </div>
    );
  }

  // recording | paused — the approved record dock: restart, stop, pause.
  const isPaused = phase === 'paused';
  return (
    <div className={dockClass}>
      <div className="flex items-center justify-between px-5">
        <DockSlot label="Restart">
          <button type="button" onClick={onRestart} className={captureRoundBtn({ size: 'lg' })} aria-label="Restart take">
            <HugeiconsIcon icon={RefreshIcon} size={20} strokeWidth={2} />
          </button>
        </DockSlot>
        <DockSlot label="Stop" strong>
          <button type="button" onClick={onGoReady} className={captureStopHero} aria-label="Stop and review recording">
            <span className="h-7.5 w-7.5 rounded-[8px] bg-acid-error short:h-6.5 short:w-6.5" />
          </button>
        </DockSlot>
        <DockSlot label={isPaused ? 'Resume' : 'Pause'}>
          <button
            type="button"
            onClick={isPaused ? onResume : onPause}
            className={captureRoundBtn({ size: 'lg', tone: isPaused ? 'success' : 'neutral' })}
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
          >
            <HugeiconsIcon icon={isPaused ? PlayIcon : PauseIcon} size={20} strokeWidth={2} />
          </button>
        </DockSlot>
      </div>
    </div>
  );
}

function DockSlot({ label, strong = false, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 short:gap-1.5">
      {children}
      <span className={strong ? 'text-xs text-acid-text-2' : 'text-xs text-acid-text-3'} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
