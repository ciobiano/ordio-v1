'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@/lib/frameRenderer';
import { loadFont } from '@/lib/fontLoader';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';
import { getCanvasDimensions, type WaveformVariant, type CaptionVariant, type FormatVariant } from '@/lib/store';
import { cn } from '@/lib/cn';

interface CanvasPreviewProps {
  playback: UsePlaybackReturn;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionStyle: CaptionVariant;
  className?: string;
}

function getFormatLabel(format: FormatVariant): string {
  switch (format) {
    case 'square':
      return '1:1';
    case 'vertical':
      return '9:16';
    case 'horizontal':
      return '16:9';
    case 'instagram':
      return '4:5';
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getContainerClass(format: FormatVariant): string {
  switch (format) {
    case 'square':
      return 'w-72 h-72 sm:w-80 sm:h-80';
    case 'vertical':
      return 'w-56 h-96';
    case 'horizontal':
      return 'w-96 h-56';
    case 'instagram':
      return 'w-72 h-[360px]';
  }
}

export default function CanvasPreview({
  playback,
  format,
  waveformStyle,
  captionStyle,
  className,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);

  const { transcript, style, audioBuffer } = useStore();

  // Load the selected font so canvas can render it, then trigger re-draw
  useEffect(() => {
    setFontLoaded(false);
    loadFont(style.fontFamily).then(() => setFontLoaded(true));
  }, [style.fontFamily]);

  // Pre-compute waveform data when audio changes
  useEffect(() => {
    if (audioBuffer) {
      waveformDataRef.current = waveformSampler(audioBuffer, 200);
    } else {
      waveformDataRef.current = [];
    }
  }, [audioBuffer]);

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions(format);

  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = playback.duration || 1;
    const totalFrames = Math.ceil(duration * FPS);
    const frameIndex = Math.min(
      Math.floor(playback.currentTime * FPS),
      totalFrames - 1
    );

    const frameOptions: FrameOptions = {
      waveformData: waveformDataRef.current,
      transcript,
      style: { ...style, width: canvasWidth, height: canvasHeight },
      waveformStyle,
      captionStyle,
    };

    renderFrame(ctx, Math.max(0, frameIndex), totalFrames, frameOptions);
  }, [playback.currentTime, playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionStyle, fontLoaded]);

  // Render loop: animate during playback, single frame when paused
  useEffect(() => {
    if (playback.isPlaying) {
      const tick = () => {
        drawCurrentFrame();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Single render when paused or seeking
      drawCurrentFrame();
    }
  }, [playback.isPlaying, drawCurrentFrame]);

  return (
    <div className={cn('relative rounded-xl overflow-hidden shadow-2xl', getContainerClass(format), className)}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full object-contain"
        role="img"
        tabIndex={-1}
        aria-label={`Video preview — ${getFormatLabel(format)} format, ${formatTime(playback.currentTime)} of ${formatTime(playback.duration)}`}
      />
      <span
        className="absolute top-2 right-2 text-[0.625rem] font-medium tracking-wider uppercase
                   text-white/40 bg-black/40 px-1.5 py-0.5 rounded"
        aria-hidden="true"
      >
        {getFormatLabel(format)}
      </span>
    </div>
  );
}
