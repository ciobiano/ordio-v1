'use client';

import { motion } from 'framer-motion';
import { Orb } from '@/components/primitives/orb/Orb';
import ProgressRing from '@/components/primitives/status/ProgressRing';
import ProcessingStep from '@/components/primitives/status/ProcessingStep';
import { Button } from '@/components/ui/button';
import { useProcessingStore } from '@/stores';
import type { EnhanceTier } from '@/stores';
import { getQualityBadge, formatRecordingTime } from './utils';
import { deriveStatusText } from './phase';
import { useIdleTypewriter } from './useIdleTypewriter';
import { useMockLiveCaption } from './useMockLiveCaption';
import type { CapturePhase } from './types';

interface CaptureStageProps {
  phase: CapturePhase;
  audioLevel: number;
  isSpeaking: boolean;
  recordingTime: number;
  processingProgress: number;
  onOrbClick?: () => void;
  onOrbPressStart?: () => void;
  onOrbPressEnd?: () => void;
  onOpenUpload: () => void;
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

function getProcessingSteps(tier: EnhanceTier): readonly string[] {
  if (tier === 'clean') {
    return ['Analyzing audio', 'Removing noise', 'Transcribing with AI', 'Preparing captions'];
  }
  if (tier === 'hd') {
    return ['Analyzing audio', 'Remastering audio', 'Transcribing with AI', 'Preparing captions'];
  }
  return ['Analyzing audio', 'Transcribing with AI', 'Preparing captions'];
}

function deriveProcessingStep(progress: number, tier: EnhanceTier): number {
  if (tier !== 'none') {
    if (progress < 15) return 0;
    if (progress < 40) return 1;
    if (progress < 75) return 2;
    return 3;
  }
  if (progress < 25) return 0;
  if (progress < 70) return 1;
  return 2;
}

export function CaptureStage({
  phase,
  audioLevel,
  isSpeaking,
  recordingTime,
  processingProgress,
  onOrbClick,
  onOrbPressStart,
  onOrbPressEnd,
  onOpenUpload,
}: CaptureStageProps) {
  const isIdle = phase === 'idle';
  const status = deriveStatusText({ phase, audioLevel, isSpeaking });
  const idleText = useIdleTypewriter(isIdle);
  const mockCaption = useMockLiveCaption(status.kind === 'voice-detected');
  const enhanceTier = useProcessingStore((s) => s.enhanceTier);

  if (phase === 'processing') {
    const steps = getProcessingSteps(enhanceTier);
    const step = deriveProcessingStep(processingProgress, enhanceTier);
    return (
      <div className="absolute top-16 bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-10 px-6">
        <div className="text-center">
          <h2 className="text-[length:var(--text-h4)] font-light text-white tracking-[-0.02em]">
            Transcribing your audio
          </h2>
          <p className="text-white/45 text-sm mt-2">This won&apos;t take long</p>
        </div>
        <ProgressRing progress={processingProgress} />
        <div className="flex flex-col items-start gap-3 w-full max-w-52">
          {steps.map((label, i) => (
            <ProcessingStep key={label} done={step > i} active={step === i && processingProgress < 100}>
              {label}
            </ProcessingStep>
          ))}
        </div>
      </div>
    );
  }

  const scale = ORB_TARGET_PX[phase] / BASE_ORB_PX;
  const isRecordingFamily = phase === 'recording' || phase === 'paused' || phase === 'ready';
  const recordingSubPhase = phase === 'ready' ? 'stopped' : 'recording';
  const qualityBadge = isRecordingFamily
    ? getQualityBadge(recordingSubPhase, phase === 'paused', audioLevel, isSpeaking)
    : null;

  return (
    <div className="absolute top-16 bottom-0 left-0 right-0 flex flex-col items-center justify-center overflow-hidden gap-4">
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

      {isIdle && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/45 text-xl tracking-[0.3px] whitespace-nowrap">
            {idleText}
            <span className="inline-block w-4 h-4 rounded-full ml-2 bg-white/55 animate-pulse" />
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenUpload}
            className="text-white/35 text-xs hover:text-white/55 hover:bg-transparent transition-colors h-auto py-1"
          >
            or upload audio or video
          </Button>
        </div>
      )}

      {isRecordingFamily && qualityBadge && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">Mic</span>
            <span className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
              <span
                className="block h-full rounded-full bg-sky-300/80 transition-[width] duration-150"
                style={{ width: `${Math.max(8, Math.min(100, Math.round(audioLevel * 120)))}%` }}
              />
            </span>
          </div>

          <span className={`rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${qualityBadge.tone}`}>
            {qualityBadge.label}
          </span>

          {status.kind === 'voice-detected' && mockCaption && (
            <p className="text-white/70 text-sm text-center max-w-72 px-4">{mockCaption}</p>
          )}

          <p className="text-white/45 text-sm font-mono tracking-widest tabular-nums">
            {phase === 'ready' ? `${formatRecordingTime(recordingTime)} recorded` : formatRecordingTime(recordingTime)}
          </p>
        </div>
      )}
    </div>
  );
}
