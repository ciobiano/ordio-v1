'use client';

import { useMemo } from 'react';
import { shareCard, shareCardHeadline } from '@/lib/variants';

export type ShareCardVariant = 'sunset' | 'acid' | 'electric';

interface ShareCardProps {
  /** The one emphasized line — a caption excerpt or a fallback prompt. */
  headline: string;
  /** Clip duration in seconds, shown as tabular mm:ss. */
  durationSeconds: number;
  /** Real audio-peak data (0..1) if available; falls back to a procedural shape. */
  waveformData?: number[];
  variant: ShareCardVariant;
  username?: string;
}

const BAR_COUNT = 40;

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/** Deterministic decorative shape (no real peaks yet) — seeded so it's stable per render, not random noise every frame. */
function proceduralBars(seed: number) {
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const v = Math.abs(Math.sin(i * 0.7 + seed) + Math.sin(i * 0.31 + seed * 1.3));
    bars.push(Math.min(1, v / 2));
  }
  return bars;
}

export function ShareCard({ headline, durationSeconds, waveformData, variant, username }: ShareCardProps) {
  const bars = useMemo(() => {
    if (waveformData && waveformData.length > 0) {
      const step = waveformData.length / BAR_COUNT;
      return Array.from({ length: BAR_COUNT }, (_, i) => waveformData[Math.floor(i * step)] ?? 0);
    }
    return proceduralBars(headline.length);
  }, [waveformData, headline]);

  const barColor = variant === 'acid' ? 'bg-acid-accent' : 'bg-white/90';
  const barColorDim = variant === 'acid' ? 'bg-acid-accent/50' : 'bg-white/45';

  return (
    <div className={shareCard({ variant })}>
      <div className="relative z-10 flex h-full flex-col justify-between p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-acid-display font-semibold text-card-title">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-black/22">
              <span className="block h-[9px] w-[9px] rounded-[3px] bg-current" />
            </span>
            Ordio
          </div>
          <span className="rounded-full bg-black/22 px-3.5 py-2 text-card-meta font-bold">Share ↗</span>
        </div>

        <div className="flex flex-col gap-5">
          <p className={`${shareCardHeadline({ variant })} text-card-headline`}>
            {headline}
          </p>
          <div className="flex h-16 items-center gap-[3px]" role="img" aria-label="Waveform preview">
            {bars.map((v, i) => (
              <span
                key={i}
                className={`flex-1 min-w-[2px] rounded-full ${i % 2 === 0 ? barColor : barColorDim}`}
                style={{ height: `${Math.max(8, Math.min(60, v * 60))}px` }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 font-acid-display font-semibold text-card-title">
              {(username ?? 'you').charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="font-acid-body font-bold text-card-title">@{username ?? 'you'}</div>
              <div className="font-acid-body text-card-meta opacity-70 tabular-nums">
                {formatDuration(durationSeconds)} · Voice note
              </div>
            </div>
          </div>
          <span className="flex h-13 w-13 items-center justify-center rounded-full bg-black/28">
            <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
              <path d="M0 0l16 9L0 18z" fill="currentColor" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
