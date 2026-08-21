'use client';

/**
 * One bar, five modes.
 *
 * The capture dock and the playback transport are the same strip of screen
 * morphing, not two bars taking turns. Before this, the dock lived inside the
 * stage frame and the transport sat below it permanently disabled — two
 * elements competing for one slot, which is exactly the arrangement LeftPanel
 * already rejects for media/transcript.
 *
 * Idle collapses the bar to nothing: no take exists, so there is nothing to
 * control, and the left panel already owns Record and Upload.
 *
 * The round buttons, tones and centre slot are mobile's — imported from the
 * same CVA definitions CaptureDock uses rather than re-declared, so the two
 * viewports cannot drift on what "pause is amber" means.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Settings01Icon,
  StopIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { captureCenterSlot, captureRoundBtn, iconButton } from '@/lib/variants';
import type { CapturePhase } from '@/lib/capture/types';

/** Bars in the recording EQ pill, staggered so the row reads as one waveform. */
const EQ_BARS = [0.42, 0.78, 0.55, 0.94, 0.36, 0.7, 0.5, 0.86, 0.44];

function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

interface DeskTransportProps {
  /** null once a clip is loaded — the bar becomes the playback transport. */
  phase: CapturePhase | null;
  /* capture */
  /** 0–100, as `useAudioProcessing` reports it. Not a 0–1 fraction. */
  processingProgress: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onProcess: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  /* playback */
  playing: boolean;
  t: number;
  duration: number;
  safeShow: boolean;
  capHidden: boolean;
  onTogglePlay: () => void;
  onSeek: (next: number) => void;
  onToggleSafe: () => void;
  onToggleCaptions: () => void;
}

/** A dock slot: the control, with its name underneath. */
function Slot({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-none flex-col items-center gap-1.5',
        grow && 'min-w-0 flex-1'
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'ord-type-footnote',
          /* The centre slot keeps a label-height spacer so `items-end` aligns
             its control with the flanking buttons, not with their baselines. */
          grow ? 'select-none text-transparent' : 'text-[var(--text-muted)]'
        )}
      >
        {grow ? '·' : label}
      </span>
    </div>
  );
}

export function DeskTransport({
  phase,
  processingProgress,
  onStop,
  onPause,
  onResume,
  onRestart,
  onProcess,
  onCancel,
  onOpenSettings,
  playing,
  t,
  duration,
  safeShow,
  capHidden,
  onTogglePlay,
  onSeek,
  onToggleSafe,
  onToggleCaptions,
}: DeskTransportProps) {
  /* Idle has no take. The bar is not disabled, it is absent. */
  if (phase === 'idle') {
    return <div className="ord-transport is-idle" aria-hidden="true" />;
  }

  if (phase === null) {
    const pct = duration > 0 ? (t / duration) * 100 : 0;
    return (
      <div className="ord-transport" data-mode="playback">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className={iconButton({ tone: 'outline', size: 'sm' })}
        >
          <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={15} strokeWidth={2} />
        </button>

        <span className="ord-mono flex-none tabular-nums">
          {formatClock(t)} / {formatClock(duration)}
        </span>

        <input
          type="range"
          className="ord-scrub"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={Math.min(t, duration)}
          aria-label="Seek"
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          style={{ ['--ord-scrub-pct' as string]: `${pct}%` }}
        />

        <button
          type="button"
          onClick={onToggleSafe}
          aria-pressed={safeShow}
          className={iconButton({ tone: safeShow ? 'active' : 'outline', size: 'sm' })}
          title="Safe zones"
        >
          <span className="ord-type-micro px-1">Safe</span>
        </button>
        <button
          type="button"
          onClick={onToggleCaptions}
          aria-pressed={!capHidden}
          className={iconButton({ tone: capHidden ? 'outline' : 'active', size: 'sm' })}
          title={capHidden ? 'Show captions' : 'Hide captions'}
        >
          <span className="ord-type-micro px-1">CC</span>
        </button>
      </div>
    );
  }

  const isRecording = phase === 'recording' || phase === 'paused';
  const isReady = phase === 'ready';
  const isProcessing = phase === 'processing';
  /* `processingProgress` is a percentage, not a fraction. Reading it as a
     fraction and multiplying by 100 put the fill at 1000% wide, which a
     browser simply clips: the bar was full and motionless from the first
     tick, which is what a broken progress bar looks like. Clamped because a
     stage that overshoots must not paint outside the button. */
  const pct = Math.max(0, Math.min(100, Math.round(processingProgress)));

  return (
    <div className="ord-transport" data-mode="capture">
      <Slot label={isRecording ? 'Stop' : 'Settings'}>
        <button
          type="button"
          onClick={isRecording ? onStop : onOpenSettings}
          aria-label={isRecording ? 'Stop and review recording' : 'Audio settings'}
          className={captureRoundBtn({ tone: isRecording ? 'primary' : 'neutral' })}
        >
          <HugeiconsIcon
            icon={isRecording ? StopIcon : Settings01Icon}
            size={18}
            strokeWidth={2}
          />
        </button>
      </Slot>

      <Slot label="" grow>
        <button
          type="button"
          disabled={!isReady}
          onClick={isReady ? onProcess : undefined}
          aria-label={isReady ? 'Process recording' : undefined}
          className={cn(
            captureCenterSlot({
              phase: isRecording ? 'recordPaused' : isReady ? 'ready' : 'processing',
            }),
            'w-full flex-none'
          )}
        >
          {isRecording && (
            <span className="flex h-full w-full items-center justify-center gap-1.5">
              {EQ_BARS.map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1 rounded-[3px] bg-[var(--ord-ink)]',
                    phase === 'recording' && 'motion-safe:animate-[ord-eq_800ms_ease-in-out_infinite]'
                  )}
                  style={{
                    height: `${18 + h * 22}px`,
                    animationDelay: `${i * 90}ms`,
                    /* Paused holds the bars low instead of freezing them
                       mid-bounce, so the state reads at a glance. */
                    transform: phase === 'paused' ? `scaleY(${0.4 + h * 0.4})` : undefined,
                  }}
                />
              ))}
            </span>
          )}
          {isReady && (
            <span className="ord-type-label font-semibold whitespace-nowrap text-[var(--ord-ink)]">
              Process recording
            </span>
          )}
          {isProcessing && (
            <>
              <span
                className="ord-progress-fill"
                style={{ ['--ord-progress-pct' as string]: `${pct}%` }}
              />
              {/* The fill alone is a white bar of unknown length — legible as
                  motion, not as a position. The figure is what makes it a
                  measurement, and it sits above the fill so it survives being
                  overtaken. */}
              <span className="relative ord-type-label font-semibold tabular-nums text-[var(--ord-ink)] mix-blend-difference">
                {pct}%
              </span>
            </>
          )}
        </button>
      </Slot>

      {!isProcessing && (
        <Slot label={phase === 'recording' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Restart'}>
          <button
            type="button"
            onClick={
              phase === 'recording' ? onPause : phase === 'paused' ? onResume : onRestart
            }
            aria-label={
              phase === 'recording'
                ? 'Pause recording'
                : phase === 'paused'
                  ? 'Resume recording'
                  : 'Restart recording'
            }
            className={captureRoundBtn({
              tone:
                phase === 'recording' ? 'warning' : phase === 'paused' ? 'success' : 'danger',
            })}
          >
            <HugeiconsIcon
              icon={phase === 'recording' ? PauseIcon : phase === 'paused' ? PlayIcon : RefreshIcon}
              size={18}
              strokeWidth={2}
            />
          </button>
        </Slot>
      )}

      <Slot label="Cancel">
        <button
          type="button"
          onClick={onCancel}
          /* The visible label is "Cancel", so the accessible name has to
             contain it — WCAG 2.5.3. Speech-control users say what they see,
             and "Discard and start over" left the one word on the button
             unable to activate it. */
          aria-label="Cancel and discard this take"
          className={captureRoundBtn({ tone: 'neutral' })}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>
      </Slot>
    </div>
  );
}
