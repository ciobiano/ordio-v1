// apps/web/src/components/soul/capture/phase.ts
import type { CapturePhase, DeriveStatusInput, DerivePhaseInput, StatusText } from './types';

/** Audio level below this is treated as "too quiet to register" — matches getQualityBadge. */
export const TOO_QUIET_THRESHOLD = 0.08;

/** Pure and total: every valid combination of the three signals maps to exactly one phase. */
export function deriveCapturePhase(input: DerivePhaseInput): CapturePhase {
  const { currentState, recordingSubPhase, isPaused } = input;

  if (currentState === 'idle') return 'idle';
  if (currentState === 'processing') return 'processing';

  // currentState === 'recording' from here. Check 'stopped' before isPaused — once the
  // recorder has been stopped, a stale isPaused:true can't leak into 'paused'.
  if (recordingSubPhase === 'stopped') return 'ready';
  return isPaused ? 'paused' : 'recording';
}

export function deriveStatusText(input: DeriveStatusInput): StatusText {
  const { phase, audioLevel, isSpeaking } = input;

  if (phase === 'idle') return { kind: 'idle-typewriter' };
  if (phase === 'paused') return { kind: 'paused' };
  if (phase === 'ready') return { kind: 'ready' };

  if (phase === 'recording') {
    if (audioLevel < TOO_QUIET_THRESHOLD) return { kind: 'too-quiet' };
    if (isSpeaking) return { kind: 'voice-detected' };
    return { kind: 'listening' };
  }

  // processing: CaptureStage doesn't render a status line during processing (progress bar owns
  // that space), but return something well-defined rather than throwing.
  return { kind: 'ready' };
}
