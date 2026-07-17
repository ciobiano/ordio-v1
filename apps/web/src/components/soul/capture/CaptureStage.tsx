'use client';

import { motion } from 'framer-motion';
import { Orb } from '@/components/primitives/orb/Orb';
import { deriveStatusText } from './phase';
import { useIdleTypewriter } from './useIdleTypewriter';
import type { CapturePhase } from './types';

interface CaptureStageProps {
  phase: CapturePhase;
  audioLevel: number;
  isSpeaking: boolean;
  /** Live transcription text (committed + interim). The stage shows the tail. */
  liveCaptionText: string;
  onOrbClick?: () => void;
  onOrbPressStart?: () => void;
  onOrbPressEnd?: () => void;
}

/** The designed slot is a ~3-line block under the orb; show the newest words. */
const LIVE_CAPTION_WORDS = 14;

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
  liveCaptionText,
  onOrbClick,
  onOrbPressStart,
  onOrbPressEnd,
}: CaptureStageProps) {
  const isIdle = phase === 'idle';
  const status = deriveStatusText({ phase, audioLevel, isSpeaking });
  const idleText = useIdleTypewriter(isIdle);
  const liveCaption = liveCaptionText
    .split(/\s+/)
    .filter(Boolean)
    .slice(-LIVE_CAPTION_WORDS)
    .join(' ');
  // Caption presence beats the VAD flicker: once real words exist, keep
  // showing them through brief isSpeaking=false gaps instead of bouncing
  // back to the "Listening" pulse.
  const showCaption =
    (status.kind === 'voice-detected' || status.kind === 'listening') && liveCaption.length > 0;

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
        {status.kind === 'idle-typewriter' && (
          <p className="text-white/45 text-xl tracking-[0.3px] whitespace-nowrap">
            {idleText}
            <span className="inline-block w-4 h-4 rounded-full ml-2 bg-white/55 animate-pulse" />
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
          <p
            className="text-white text-[22px] font-semibold text-center leading-[1.35] max-w-80"
            aria-live="polite"
          >
            {liveCaption}
          </p>
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
