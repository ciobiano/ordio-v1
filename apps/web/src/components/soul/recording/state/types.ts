import type { FeatureKey } from '@/lib/featureGates';

export type RecordingPhase = 'recording' | 'stopped';

export interface RecordingStateProps {
  audioLevel: number;
  isSpeaking: boolean;
  isPaused: boolean;
  recordingTime: number;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onRestart: () => void;
  onProceed: () => void;
  onCancel: () => void;
  onLocked: (feature: FeatureKey) => void;
}

