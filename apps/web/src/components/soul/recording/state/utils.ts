import type { RecordingPhase } from './types';

export function formatRecordingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getQualityBadge(
  phase: RecordingPhase,
  isPaused: boolean,
  audioLevel: number,
  isSpeaking: boolean
) {
  if (phase === 'stopped') {
    return {
      label: 'Ready to process',
      tone: 'text-emerald-200 bg-emerald-500/15 border-emerald-300/30',
    };
  }

  if (isPaused) {
    return {
      label: 'Paused',
      tone: 'text-amber-200 bg-amber-500/15 border-amber-300/30',
    };
  }

  if (audioLevel < 0.08) {
    return {
      label: 'Too quiet',
      tone: 'text-amber-200 bg-amber-500/15 border-amber-300/30',
    };
  }

  if (isSpeaking) {
    return {
      label: 'Voice detected',
      tone: 'text-emerald-200 bg-emerald-500/15 border-emerald-300/30',
    };
  }

  return {
    label: 'Listening',
    tone: 'text-sky-200 bg-sky-500/15 border-sky-300/30',
  };
}

export function getOrbState(
  phase: RecordingPhase,
  isPaused: boolean,
  isSpeaking: boolean
): 'thinking' | 'speaking' | 'listening' {
  if (phase === 'stopped') return 'thinking';
  if (isPaused) return 'listening';
  return isSpeaking ? 'speaking' : 'listening';
}

export function getOrbIntensity(
  phase: RecordingPhase,
  isPaused: boolean,
  audioLevel: number
) {
  if (phase === 'stopped') return 0;
  if (isPaused) return 0.25;
  return audioLevel;
}

