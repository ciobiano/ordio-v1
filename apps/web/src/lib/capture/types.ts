// apps/web/src/lib/capture/types.ts

/** The five phases a capture surface morphs through, on any viewport. */
export type CapturePhase = 'idle' | 'recording' | 'paused' | 'ready' | 'processing';

/** Local recording sub-phase, distinct from `paused` — mirrors the old RecordingState's phase. */
export type RecordingSubPhase = 'recording' | 'stopped';

export interface DerivePhaseInput {
  /** Top-level app state from useUIStore. */
  currentState: 'idle' | 'recording' | 'processing';
  /** Local recording sub-phase: 'recording' while capturing, 'stopped' once the user taps stop. */
  recordingSubPhase: RecordingSubPhase;
  /** Whether the recorder is currently paused. */
  isPaused: boolean;
}

export type StatusText =
  | { kind: 'idle' }
  | { kind: 'paused' }
  | { kind: 'too-quiet' }
  | { kind: 'listening' }
  | { kind: 'voice-detected' }
  | { kind: 'ready' };

export interface DeriveStatusInput {
  phase: CapturePhase;
  audioLevel: number;
  isSpeaking: boolean;
}
