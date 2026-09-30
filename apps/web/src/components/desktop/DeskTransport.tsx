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
import { captureCenterSlot, captureRoundBtn } from '@/lib/variants';
import type { CapturePhase } from '@/lib/capture/types';

/** Bars in the recording EQ pill, staggered so the row reads as one waveform. */
const EQ_BARS = [0.42, 0.78, 0.55, 0.94, 0.36, 0.7, 0.5, 0.86, 0.44];

const SKIP_SECONDS = 5;

function clockParts(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const whole = Math.floor(safe);
  return {
    main: `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`,
    hundredths: String(Math.floor((safe - whole) * 100)).padStart(2, '0'),
  };
}

function formatClockPadded(seconds: number) {
  return clockParts(seconds).main;
}

const roundGhost =
  'flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--ord-paper)]/8 ' +
  'text-[var(--ord-paper)] transition-colors duration-[var(--dur-tap)] hover:bg-[var(--ord-paper)]/12 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]';

/** A curved arrow with the skip distance inside it. */
function SkipGlyph({ dir }: { dir: 'back' | 'forward' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <g transform={dir === 'forward' ? 'translate(18 0) scale(-1 1)' : undefined}>
        <path d="M4 9a5 5 0 1 0 1.6-3.7M4 3v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="9" y="11.2" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="currentColor">
        {SKIP_SECONDS}
      </text>
    </svg>
  );
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
    const now = clockParts(t);
    return (
      <div className="ord-transport" data-mode="playback">
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

        <div className="flex items-center justify-between gap-4">
          <span className="w-44 flex-none font-[family-name:var(--font-mono)] text-[15px] tabular-nums text-[var(--ord-paper)]">
            {now.main}
            <span className="text-[var(--text-muted)]">
              .{now.hundredths} / {formatClockPadded(duration)}
            </span>
          </span>

          {/* Capture-dock shapes: round skip buttons either side of one big
              paper play — the same controls the phone's record screen uses,
              so the two ends of the product press the same way. */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, t - SKIP_SECONDS))}
              aria-label={`Back ${SKIP_SECONDS} seconds`}
              className={roundGhost}
            >
              <SkipGlyph dir="back" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="flex size-14 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--ord-paper)] text-[var(--ord-ink)] transition-transform duration-[var(--dur-tap)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] motion-reduce:transition-none"
            >
              <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={20} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.min(duration, t + SKIP_SECONDS))}
              aria-label={`Forward ${SKIP_SECONDS} seconds`}
              className={roundGhost}
            >
              <SkipGlyph dir="forward" />
            </button>
          </div>

          <div className="flex w-44 flex-none justify-end gap-2">
            <button
              type="button"
              onClick={onToggleSafe}
              aria-pressed={safeShow}
              title="Safe zones"
              className={cn(
                'h-8 cursor-pointer rounded-full border-0 px-3 font-[family-name:var(--font-mono)] text-[11px] tracking-wide transition-colors duration-[var(--dur-tap)]',
                safeShow
                  ? 'bg-[var(--ord-cyan)]/12 text-[var(--ord-cyan)]'
                  : 'bg-[var(--ord-paper)]/8 text-[var(--text-body)] hover:text-[var(--ord-paper)]'
              )}
            >
              SAFE ZONES
            </button>
            <button
              type="button"
              onClick={onToggleCaptions}
              aria-pressed={!capHidden}
              aria-label={capHidden ? 'Show captions' : 'Hide captions'}
              title={capHidden ? 'Show captions' : 'Hide captions'}
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-full border-0 font-[family-name:var(--font-mono)] text-[10px] transition-colors duration-[var(--dur-tap)]',
                capHidden
                  ? 'bg-transparent text-[var(--text-muted)] ring-1 ring-[var(--border-hairline)]'
                  : 'bg-[var(--ord-paper)]/8 text-[var(--ord-paper)]'
              )}
            >
              CC
            </button>
          </div>
        </div>
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
