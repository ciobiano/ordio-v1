'use client';

import WaveformDisplay from '@/components/primitives/waveform/WaveformDisplay';
import RecordingTimer from '@/components/primitives/RecordingTimer';
import LiveCaption from '@/components/primitives/LiveCaption';
import type { WaveformVariant, CaptionVariant } from '@/lib/store';

interface RecordingStateProps {
  onStopRecording: () => void;
  audioLevel: number;
  liveWords: string[];
  captionStyle: CaptionVariant;
  waveformStyle: WaveformVariant;
}

export default function RecordingState({
  onStopRecording,
  audioLevel,
  liveWords,
  captionStyle,
  waveformStyle,
}: RecordingStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 animate-fadeIn w-full max-w-sm">
      <div className="flex items-center gap-2.5" role="status" aria-live="polite">
        <div className="w-2 h-2 rounded-full bg-[#e11d48] animate-pulse" aria-hidden="true" />
        <span className="text-white/40 text-[0.6875rem] tracking-[0.18em] uppercase">
          recording
        </span>
      </div>

      <RecordingTimer />

      <WaveformDisplay variant={waveformStyle} level={audioLevel} isRecording={true} />

      <div
        className="w-full min-h-[5rem] flex items-center justify-center
                   bg-white/[0.03] rounded-2xl px-4 sm:px-6 py-4 border border-white/[0.06]"
        role="region"
        aria-label="Live transcription"
        aria-live="polite"
      >
        {liveWords.length > 0 ? (
          <LiveCaption words={liveWords} style={captionStyle} />
        ) : (
          <p className="text-white/25 text-sm animate-pulse">Listening&hellip;</p>
        )}
      </div>

      <button
        onClick={onStopRecording}
        aria-label="Stop recording"
        className="group relative w-[4.5rem] h-[4.5rem] rounded-full mt-4
                   bg-[#e11d48]/[0.12] border-2 border-[#e11d48]/30
                   hover:bg-[#e11d48]/20 hover:border-[#e11d48]/50
                   transition-all duration-200
                   hover:scale-105 active:scale-[0.96] cursor-pointer"
      >
        <span className="sr-only">Stop recording</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-[4px] bg-[#e11d48]" aria-hidden="true" />
        </div>
      </button>

      <p className="text-white/18 text-[0.6875rem] tracking-[0.18em] uppercase">
        tap to finish
      </p>
    </div>
  );
}
