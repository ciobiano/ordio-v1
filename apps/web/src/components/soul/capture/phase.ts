// apps/web/src/components/soul/capture/phase.ts
import type { CapturePhase, DeriveStatusInput, DerivePhaseInput, StatusText } from './types';

/** Audio level below this is treated as "too quiet to register" — matches getQualityBadge. */
export const TOO_QUIET_THRESHOLD = 0.08;

// TODO(human): Implement deriveCapturePhase.
//
// This is the merge function that turns three independent signals into the single
// CapturePhase value everything else in the Capture screen renders off of:
//
//   currentState: 'idle' | 'recording' | 'processing'  (top-level app state, from useUIStore)
//   recordingSubPhase: 'recording' | 'stopped'          (local, mirrors old RecordingState phase)
//   isPaused: boolean                                    (from the recorder hook)
//
// Target mapping (from docs/superpowers/specs/2026-07-07-unified-capture-screen-design.md):
//
//   currentState === 'idle'                                          -> 'idle'
//   currentState === 'recording', recordingSubPhase === 'recording', !isPaused -> 'recording'
//   currentState === 'recording', recordingSubPhase === 'recording', isPaused  -> 'paused'
//   currentState === 'recording', recordingSubPhase === 'stopped'    -> 'ready'
//   currentState === 'processing'                                    -> 'processing'
//
// Things to think through as you implement:
// - What should happen if `recordingSubPhase` is stale from a previous recording (e.g. still
//   'stopped' right after a restart resets currentState to 'recording')? Look at how
//   RecordingState.tsx's handleRestart/handleResume used to reset `phase` to 'recording' — your
//   function needs the same guarantee, but as a pure derivation it can't reset state itself, so
//   think about whether the *caller* (CaptureScreen) needs to reset `recordingSubPhase` at the
//   right moments, or whether this function should treat `isPaused` specially even when
//   `recordingSubPhase` briefly disagrees.
// - `isPaused` is meaningless when `recordingSubPhase === 'stopped'` (you're not paused, you're
//   done) — make sure a stale `isPaused: true` can't leak the phase into something wrong.
// - This function should be pure and total: every valid combination of inputs maps to exactly
//   one CapturePhase, with no throws.
export function deriveCapturePhase(input: DerivePhaseInput): CapturePhase {
  throw new Error('deriveCapturePhase not implemented');
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
