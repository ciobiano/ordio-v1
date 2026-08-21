'use client';

/**
 * The centre stage while there is no clip yet.
 *
 * Content only — orb, status line, live captions, processing steps. Every
 * control lives in DeskTransport, which is the same strip of screen morphing
 * from capture dock to playback bar. Putting a dock in here as well is what
 * left the transport sitting below it in a permanently disabled state.
 *
 * The Orb is the real component, not a desktop copy of it. Only the size
 * ladder differs, because the stage is bigger than a phone.
 */

import { motion } from 'framer-motion';
import { Orb } from '@/components/media/orb/Orb';
import { deriveStatusText } from '@/lib/capture/phase';
import { PROCESSING_STEPS, processingStepState } from '@/lib/capture/processingSteps';
import type { CapturePhase } from '@/lib/capture/types';

/**
 * Orb renders at `w-60` (240px) from the `md` breakpoint up, and the desk only
 * exists above `lg` — so 240 is the base to scale against here, not the 200
 * mobile uses. Scaling against 200 would render every phase 20% too large.
 */
const BASE_ORB_PX = 240;

/** Mobile's 216/200/196/128 ladder, opened up for a desktop stage. */
const DESK_ORB_PX: Record<CapturePhase, number> = {
  idle: 200,
  recording: 184,
  paused: 184,
  ready: 176,
  processing: 112,
};

const EASE = [0.32, 0.72, 0, 1] as const;

function orbStateFor(phase: CapturePhase, isSpeaking: boolean) {
  switch (phase) {
    case 'idle':
      return 'dormant' as const;
    case 'recording':
      return isSpeaking ? ('speaking' as const) : ('listening' as const);
    case 'paused':
      return 'listening' as const;
    case 'ready':
    case 'processing':
      return 'resting' as const;
  }
}

function orbIntensityFor(phase: CapturePhase, audioLevel: number) {
  if (phase === 'recording') return audioLevel;
  if (phase === 'paused') return 0.25;
  return 0;
}

/** The four stages of processing, in the order useAudioProcessing runs them. */

interface DeskCaptureStageProps {
  phase: CapturePhase;
  audioLevel: number;
  isSpeaking: boolean;
  micDenied: boolean;
  /** Why the last start attempt failed, if it was not a permission refusal. */
  startError: string | null;
  canRecord: boolean;
  isStarting: boolean;
  /** 0–100, as `useAudioProcessing` reports it. Not a 0–1 fraction. */
  processingProgress: number;
  committedCaptionLines: string[];
  interimCaptionText: string;
  elapsedLabel: string;
  onPressStart: () => void;
  onPressEnd: () => void;
}

export function DeskCaptureStage({
  phase,
  audioLevel,
  isSpeaking,
  micDenied,
  startError,
  canRecord,
  isStarting,
  processingProgress,
  committedCaptionLines,
  interimCaptionText,
  elapsedLabel,
  onPressStart,
  onPressEnd,
}: DeskCaptureStageProps) {
  const isIdle = phase === 'idle';
  const status = deriveStatusText({ phase, audioLevel, isSpeaking });

  /* Apple Music lyric model, same as mobile: the line just said recedes above
     the line being said, rather than everything flattening into a paragraph. */
  const hasInterim = interimCaptionText.trim().length > 0;
  const currentIndex = hasInterim
    ? committedCaptionLines.length
    : committedCaptionLines.length - 1;
  const currentLine = hasInterim
    ? interimCaptionText
    : (committedCaptionLines[currentIndex] ?? '');
  const pastLine = currentIndex >= 1 ? committedCaptionLines[currentIndex - 1] : '';
  const showCaption =
    (status.kind === 'voice-detected' || status.kind === 'listening') &&
    currentLine.length > 0;

  const pressable = isIdle && canRecord && !micDenied && !isStarting;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-5">
      {phase === 'recording' && (
        <span className="flex items-center gap-2">
          <span className="size-[9px] rounded-full bg-[var(--ord-rose)] motion-safe:animate-pulse" />
          <span className="ord-type-caps text-[var(--ord-rose)]">Recording</span>
          <span className="ord-mono tabular-nums text-[var(--text-body)]">
            {elapsedLabel}
          </span>
        </span>
      )}

      <motion.div
        animate={{ scale: DESK_ORB_PX[phase] / BASE_ORB_PX }}
        transition={{ duration: 0.38, ease: EASE }}
        className="flex items-center justify-center"
      >
        <Orb
          state={orbStateFor(phase, isSpeaking)}
          intensity={orbIntensityFor(phase, audioLevel)}
          isSpeaking={isSpeaking}
          /* Orb only wires pointer handlers when onClick is present. The click
             itself is a no-op — pointerdown and pointerup own start and finish,
             exactly as on mobile. */
          onClick={pressable ? () => {} : undefined}
          onPressStart={pressable ? onPressStart : undefined}
          onPressEnd={pressable ? onPressEnd : undefined}
          ariaLabel="Press and hold to record"
        />
      </motion.div>

      <div className="flex min-h-[58px] w-full max-w-[34ch] flex-col items-center justify-center gap-1">
        {isIdle && (micDenied || startError) ? (
          /* A failed start has to say so. Returning silently made a broken
             microphone and an unwired button look identical from here. */
          <p role="alert" className="text-center ord-type-body text-[var(--ord-rose)]">
            {micDenied
              ? 'Ordio cannot reach your microphone. Allow it in your browser, then try again.'
              : startError}
          </p>
        ) : !canRecord && isIdle ? (
          <p role="alert" className="text-center ord-type-body text-[var(--ord-rose)]">
            This browser cannot record audio. Try Chrome or Edge, or upload a
            file instead.
          </p>
        ) : showCaption ? (
          <div aria-live="polite" className="flex w-full flex-col items-center gap-1">
            {pastLine && (
              <p className="w-full truncate text-center ord-type-caption text-[var(--text-muted)]">
                {pastLine}
              </p>
            )}
            <p className="text-center ord-type-subtitle font-bold text-[var(--ord-paper)]">
              {currentLine}
            </p>
          </div>
        ) : (
          <p className="text-center ord-type-body text-[var(--text-muted)]">
            {status.kind === 'idle' && 'Press and hold to record'}
            {status.kind === 'paused' && 'Paused'}
            {status.kind === 'too-quiet' && 'Too quiet'}
            {(status.kind === 'listening' || status.kind === 'voice-detected') &&
              'Listening'}
            {status.kind === 'ready' && phase === 'ready' && 'Ready to process'}
            {status.kind === 'ready' && phase === 'processing' && 'Working on it'}
          </p>
        )}
      </div>

      {phase === 'processing' && (
        <ol className="flex w-full max-w-[34ch] flex-col gap-2">
          {PROCESSING_STEPS.map((step, i) => {
            const state = processingStepState(i, processingProgress);
            const done = state === 'done';
            const now = state === 'now';
            return (
              <li
                key={step.label}
                className="flex items-center gap-2 ord-type-footnote"
                data-state={state}
              >
                <span
                  aria-hidden="true"
                  className={
                    'flex size-[15px] flex-none items-center justify-center rounded-full border ord-type-micro ' +
                    (done
                      ? 'border-[var(--text-body)] text-[var(--text-body)]'
                      : now
                        ? 'border-dashed border-[var(--ord-acid)]'
                        : 'border-[var(--text-muted)]')
                  }
                >
                  {done ? '✓' : ''}
                </span>
                <span
                  className={
                    done
                      ? 'text-[var(--text-body)]'
                      : now
                        ? 'font-bold text-[var(--ord-paper)]'
                        : 'text-[var(--text-muted)]'
                  }
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
