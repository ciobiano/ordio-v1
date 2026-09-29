'use client';

import { useEffect, useRef, useState } from 'react';
import { deriveStatusText } from '@/lib/capture/phase';
import type { CapturePhase } from '@/lib/capture/types';
import { formatRecordClock } from '@/lib/capture/recordClock';

interface CaptureRecordViewProps {
  phase: Extract<CapturePhase, 'recording' | 'paused' | 'ready'>;
  audioLevel: number;
  isSpeaking: boolean;
  committedCaptionLines: string[];
  interimCaptionText: string;
}

/** Bars in the rolling waveform. The newest sits just left of the playhead. */
const WAVE_BARS = 34;
/** Empty slots to the right of the playhead — the take has not reached them yet. */
const WAVE_AHEAD = 14;
const WAVE_SAMPLE_MS = 90;
const TICK_MS = 50;

const STATUS_LINE: Record<ReturnType<typeof deriveStatusText>['kind'], string> = {
  idle: '',
  paused: 'Paused',
  'too-quiet': 'Too quiet — move a little closer',
  listening: 'Listening',
  'voice-detected': 'Recording',
  ready: 'Ready to process',
};

/**
 * Elapsed recording time. Counts only while recording: pausing freezes it,
 * resuming continues from where it stopped, and it survives into `ready` so
 * the finished length stays on screen.
 */
function useTakeClock(phase: CaptureRecordViewProps['phase']) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const bankedRef = useRef(0);

  useEffect(() => {
    if (phase !== 'recording') return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(bankedRef.current + Date.now() - startedAt), TICK_MS);
    return () => {
      clearInterval(timer);
      bankedRef.current += Date.now() - startedAt;
      setElapsedMs(bankedRef.current);
    };
  }, [phase]);

  return elapsedMs;
}

/**
 * A rolling history of input level — one bar per sample, oldest on the left.
 * Samples only while recording, so a paused take shows a frozen wave rather
 * than a flat line that would read as "the mic died".
 */
function useLevelHistory(phase: CaptureRecordViewProps['phase'], audioLevel: number) {
  const levelRef = useRef(audioLevel);
  levelRef.current = audioLevel;
  const [history, setHistory] = useState<number[]>(() => Array(WAVE_BARS).fill(0));

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      setHistory((prev) => [...prev.slice(1), Math.min(1, Math.max(0, levelRef.current))]);
    }, WAVE_SAMPLE_MS);
    return () => clearInterval(timer);
  }, [phase]);

  return history;
}

/**
 * The record screen body: clock, live waveform and the running transcript.
 *
 * The approved capture design. The orb that used to fill this space said
 * "something is listening" but not what it heard or for how long; the clock
 * answers how long, the wave answers whether the mic is picking you up, and the
 * transcript card answers what it heard — the three things people glance down
 * to check mid-take.
 */
export function CaptureRecordView({
  phase,
  audioLevel,
  isSpeaking,
  committedCaptionLines,
  interimCaptionText,
}: CaptureRecordViewProps) {
  const elapsedMs = useTakeClock(phase);
  const history = useLevelHistory(phase, audioLevel);
  const clock = formatRecordClock(elapsedMs);
  const status = deriveStatusText({ phase, audioLevel, isSpeaking });

  const hasInterim = interimCaptionText.trim().length > 0;
  const pastLines = hasInterim ? committedCaptionLines.slice(-1) : committedCaptionLines.slice(-2, -1);
  const currentLine = hasInterim ? interimCaptionText : (committedCaptionLines.at(-1) ?? '');
  const isLive = phase === 'recording';

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4">
      <div className="flex flex-col items-center gap-1.5 pt-6 short:pt-2">
        <span
          className="font-acid-mono text-6xl leading-none tracking-tighter text-acid-text-1 tabular-nums short:text-5xl"
          role="timer"
          aria-label={`Recorded ${clock.spoken}`}
        >
          {clock.main}
          <span className="text-acid-text-3">.{clock.hundredths}</span>
        </span>
        <span className="text-sm text-acid-text-3" aria-live="polite">
          {STATUS_LINE[status.kind]}
        </span>
      </div>

      <div aria-hidden="true" className="mt-7 h-33 shrink-0 overflow-hidden short:mt-4 short:h-22">
        <div className="flex h-full items-center justify-center gap-0.75">
          {history.map((level, i) => (
            <span
              key={i}
              className="w-1 shrink-0 rounded-full bg-acid-text-1 transition-[height] duration-100 ease-out"
              style={{
                height: `${Math.max(4, level * 100)}%`,
                opacity: 0.2 + (0.8 * i) / (WAVE_BARS - 1),
              }}
            />
          ))}
          <span
            className={isLive ? 'ml-1 h-full w-0.5 shrink-0 rounded-full bg-acid-error' : 'ml-1 h-full w-0.5 shrink-0 rounded-full bg-acid-warning'}
          />
          {Array.from({ length: WAVE_AHEAD }, (_, i) => (
            <span key={`ahead-${i}`} className="h-1 w-1 shrink-0 rounded-full bg-acid-text-1/12" />
          ))}
        </div>
      </div>

      <section
        aria-label="Live transcript"
        className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-3xl border border-acid-border-subtle bg-acid-bg-subtle p-5 short:mt-3 short:p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-acid-mono text-[11px] tracking-widest text-acid-text-3 uppercase">Live transcript</span>
          <span className="text-xs text-acid-text-3">Final captions after you stop</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden" aria-live="polite">
          {currentLine.length === 0 ? (
            <p className="m-0 text-xl leading-snug tracking-tight text-acid-text-3 short:text-lg">
              {isLive ? 'Start talking — your words land here as you say them.' : 'Nothing transcribed yet.'}
            </p>
          ) : (
            <>
              {pastLines.map((line, i) => (
                <p key={i} className="m-0 line-clamp-2 text-xl leading-snug tracking-tight text-acid-text-3 short:text-lg">
                  {line}
                </p>
              ))}
              <p className="m-0 text-xl leading-snug tracking-tight text-acid-text-1 short:text-lg">
                {currentLine}
                {isLive && (
                  <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.75 animate-pulse bg-acid-text-1" />
                )}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
