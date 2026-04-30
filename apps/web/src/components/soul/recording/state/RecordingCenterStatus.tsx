'use client';

import { Orb } from '@/components/primitives/orb/Orb';
import type { RecordingPhase } from './types';
import { formatRecordingTime } from './utils';

type RecordingCenterStatusProps = {
  phase: RecordingPhase;
  orbState: 'thinking' | 'speaking' | 'listening';
  orbIntensity: number;
  isSpeaking: boolean;
  audioLevel: number;
  qualityBadge: { label: string; tone: string };
  recordingTime: number;
};

export function RecordingCenterStatus({
  phase,
  orbState,
  orbIntensity,
  isSpeaking,
  audioLevel,
  qualityBadge,
  recordingTime,
}: RecordingCenterStatusProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <Orb state={orbState} intensity={orbIntensity} isSpeaking={isSpeaking} layoutId="orb" />

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

      <p className="text-white/45 text-sm font-mono tracking-widest mt-4 tabular-nums">
        {phase === 'stopped'
          ? `${formatRecordingTime(recordingTime)} recorded`
          : formatRecordingTime(recordingTime)}
      </p>
    </div>
  );
}

