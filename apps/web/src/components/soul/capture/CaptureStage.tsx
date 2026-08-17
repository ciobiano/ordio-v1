'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Orb } from '@/components/primitives/orb/Orb';
import { deriveStatusText } from './phase';
/**
 * The idle prompt is static. It used to type itself out and cycle between two
 * phrases on a 42ms/char, 2000ms-hold, 26ms/char-delete loop — motion that ran
 * forever on a screen whose whole job is to wait, and slow enough that the
 * instruction was often mid-deletion when you looked at it. It names the actual
 * gesture (the dock's record button fires on pointerdown), so it only needs to
 * be readable.
 */
const IDLE_PROMPT = 'Press and hold to record';
import type { CapturePhase } from './types';

interface CaptureStageProps {
  phase: CapturePhase;
  audioLevel: number;
  isSpeaking: boolean;
  /** Finished utterances, in order — the just-said line recedes above the active one. */
  committedCaptionLines: string[];
  /** Text of the utterance currently being transcribed, if any. */
  interimCaptionText: string;
  onOrbClick?: () => void;
  onOrbPressStart?: () => void;
  onOrbPressEnd?: () => void;
}

/** Base orb render size is 200px (Orb's own w-50 class) — scale relative to that per phase. */
const BASE_ORB_PX = 200;
const ORB_TARGET_PX: Record<CapturePhase, number> = {
  idle: 216,
  recording: 200,
  paused: 200,
  ready: 196,
  processing: 128,
};

const EASE = [0.32, 0.72, 0, 1] as const;

function orbStateFor(phase: CapturePhase, isSpeaking: boolean) {
  switch (phase) {
    case 'idle':
      return 'dormant' as const;
    case 'recording':
      return isSpeaking ? 'speaking' as const : 'listening' as const;
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

export function CaptureStage({
  phase,
  audioLevel,
  isSpeaking,
  committedCaptionLines,
  interimCaptionText,
  onOrbClick,
  onOrbPressStart,
  onOrbPressEnd,
}: CaptureStageProps) {
  const isIdle = phase === 'idle';
  const status = deriveStatusText({ phase, audioLevel, isSpeaking });

  // Apple Music lyrics model: one line is "current" (bright, prominent) and the
  // line just before it recedes above (dim, small) rather than everything
  // flattening into one scrolling paragraph. While a new utterance is being
  // transcribed it IS current; once it commits, it keeps that same slot (no
  // remount) until the next utterance starts and takes over as current.
  const hasInterim = interimCaptionText.trim().length > 0;
  const currentSlotIndex = hasInterim
    ? committedCaptionLines.length
    : committedCaptionLines.length - 1;
  const pastSlotIndex = currentSlotIndex - 1;
  const currentLine = hasInterim ? interimCaptionText : (committedCaptionLines[currentSlotIndex] ?? '');
  const pastLine = pastSlotIndex >= 0 ? committedCaptionLines[pastSlotIndex] : '';

  // Caption presence beats the VAD flicker: once real words exist, keep
  // showing them through brief isSpeaking=false gaps instead of bouncing
  // back to the "Listening" pulse.
  const showCaption =
    (status.kind === 'voice-detected' || status.kind === 'listening') && currentLine.length > 0;

  const scale = ORB_TARGET_PX[phase] / BASE_ORB_PX;

  return (
    <div className="absolute top-16 bottom-[150px] left-0 right-0 flex flex-col items-center justify-center overflow-hidden">
      <motion.div
        animate={{ scale }}
        transition={{ duration: 0.38, ease: EASE }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Orb
          state={orbStateFor(phase, isSpeaking)}
          intensity={orbIntensityFor(phase, audioLevel)}
          isSpeaking={isSpeaking}
          onClick={isIdle ? onOrbClick : undefined}
          onPressStart={isIdle ? onOrbPressStart : undefined}
          onPressEnd={isIdle ? onOrbPressEnd : undefined}
          ariaLabel="Press and hold to record"
        />
      </motion.div>

      <div className="flex items-center justify-center w-full px-8 min-h-16 mt-6.5">
        {status.kind === 'idle' && (
          <p className="text-white/45 text-xl tracking-[0.3px] whitespace-nowrap">
            {IDLE_PROMPT}
          </p>
        )}
        {status.kind === 'paused' && <p className="text-white/45 text-xl">Paused</p>}
        {status.kind === 'too-quiet' && <p className="text-white/45 text-xl">Too quiet</p>}
        {status.kind === 'listening' && !showCaption && (
          <p className="text-white/45 text-xl tracking-[0.3px]">
            Listening
            <span className="inline-block w-4 h-4 rounded-full ml-2 bg-white/55 animate-pulse" />
          </p>
        )}
        {showCaption && (
          <div className="flex flex-col items-center gap-1 w-full max-w-80" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {pastLine && (
                <motion.p
                  key={`past-${pastSlotIndex}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="text-white/40 text-base font-medium text-center leading-snug truncate w-full"
                >
                  {pastLine}
                </motion.p>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout">
              <motion.p
                key={`current-${currentSlotIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="text-white text-[22px] font-semibold text-center leading-[1.35]"
              >
                {currentLine}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
        {status.kind === 'voice-detected' && !showCaption && (
          <p className="text-white/45 text-xl tracking-[0.3px]">
            Listening
            <span className="inline-block w-4 h-4 rounded-full ml-2 bg-white/55 animate-pulse" />
          </p>
        )}
        {status.kind === 'ready' && <p className="text-white/45 text-xl">Ready to process</p>}
      </div>
    </div>
  );
}
