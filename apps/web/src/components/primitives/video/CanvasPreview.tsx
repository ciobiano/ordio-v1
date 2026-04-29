'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useUIStore, useProcessingStore, useCaptureStore, getCanvasDimensions } from '@/stores';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@/lib/video';
import { loadFont } from '@/lib/loaders';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import { loadGraphic } from '@/lib/loaders';
import { cn } from '@/lib/utils';

interface CanvasPreviewProps {
  playback: UsePlaybackReturn;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  canvasLayout?: CanvasLayout;
  showWatermark?: boolean;
  graphicStyle?: GraphicStyleId;
  className?: string;
  showGrid?: boolean;
  gridSize?: number;
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
      return 'w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80';
    case 'vertical':
      return 'w-44 h-[312px] sm:w-56 sm:h-96';
    case 'horizontal':
      return 'w-full max-w-96 h-44 sm:h-56';
    case 'instagram':
      return 'w-52 h-[260px] sm:w-64 sm:h-80';
  }
}

export default function CanvasPreview({
  playback,
  format,
  waveformStyle,
  captionMode,
  canvasLayout,
  showWatermark = false,
  graphicStyle,
  className,
  showGrid = false,
  gridSize = 24,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  const transcript = useProcessingStore((s) => s.transcript);
  const captionGroups = useProcessingStore((s) => s.captionGroups);
  const style = useUIStore((s) => s.style);
  const captionAnimation = useUIStore((s) => s.captionAnimation);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);

  // Load the selected font so canvas can render it, then trigger re-draw
  useEffect(() => {
    setFontLoaded(false);
    loadFont(style.fontFamily).then(() => setFontLoaded(true));
  }, [style.fontFamily]);

  // Pre-load graphic asset when graphic style changes
  useEffect(() => {
    if (graphicStyle) loadGraphic(graphicStyle);
  }, [graphicStyle]);

  // Pre-compute waveform data when audio changes
  useEffect(() => {
    if (audioBuffer) {
      waveformDataRef.current = waveformSampler(audioBuffer, 200);
    } else {
      waveformDataRef.current = [];
    }
  }, [audioBuffer]);

  // HUD time display (listen to playback time updates)
  useEffect(() => {
    const unbindTime = playback.registerTimeListener((t) => {
      currentTimeRef.current = t;
      setDisplayTime(t);
    });
    return unbindTime;
  }, [playback]);

  useEffect(() => {
    currentTimeRef.current = playback.currentTime;
    setDisplayTime(playback.currentTime);
  }, [playback.currentTime]);

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions(format);

  // Optional grid overlay styling
  const gridOverlayStyle = {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      `linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), ` +
      `linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    pointerEvents: 'none',
    mixBlendMode: 'overlay',
  } as const;

  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = playback.duration || 1;
    const totalFrames = Math.ceil(duration * FPS);
    const frameIndex = Math.min(
      Math.floor(currentTimeRef.current * FPS),
      totalFrames - 1
    );

    const frameOptions: FrameOptions = {
      waveformData: waveformDataRef.current,
      transcript,
      style: { ...style, width: canvasWidth, height: canvasHeight },
      waveformStyle,
      captionMode,
      canvasLayout,
      showWatermark,
      graphicStyle,
      captionGroups,
      captionAnimation,
    };

    renderFrame(ctx, Math.max(0, frameIndex), totalFrames, frameOptions);
  }, [playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionMode, canvasLayout, showWatermark, graphicStyle, captionGroups, captionAnimation, fontLoaded]);

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

  // Keyboard shortcut: Space to toggle play/pause (ignore inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (playback.isPlaying) playback.pause(); else playback.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback]);

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10',
        getContainerClass(format),
        className
      )}
      style={{
        boxShadow:
          '0 18px 48px rgba(0, 0, 0, 0.42), inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full object-contain"
        role="img"
        tabIndex={-1}
        aria-label={`Video preview — ${getFormatLabel(format)} format, ${formatTime(playback.currentTime)} of ${formatTime(playback.duration)}`}
      />
      {/* Optional grid overlay for composition studies */}
      {showGrid && <div aria-hidden="true" style={gridOverlayStyle} />}
      {/* HUD: time & format badge */}
      <div className="absolute top-2 left-2 z-20 bg-black/40 text-xs text-white px-2 py-0.5 rounded backdrop-blur" aria-hidden="true">
        {getFormatLabel(format)} • {formatTime(displayTime)} / {formatTime(playback.duration)}
      </div>
      {/* Center Play/Pause control for quick interaction */}
      <button
        aria-label={playback.isPlaying ? 'Pause preview' : 'Play preview'}
        onClick={() => (playback.isPlaying ? playback.pause() : playback.play())}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-full bg-black/60 hover:bg-black/80 text-white w-12 h-12 flex items-center justify-center border border-white/20 shadow-xl"
        style={{ padding: 0 }}
      >
        {playback.isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Pause" role="img">
            <rect x="6" y="5" width="4" height="14" fill="currentColor" rx="1" />
            <rect x="14" y="5" width="4" height="14" fill="currentColor" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Play" role="img">
            <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span
        className="absolute top-2 right-2 text-xs font-medium tracking-wider uppercase
                   text-white/40 bg-black/40 px-1.5 py-0.5 rounded"
        aria-hidden="true"
      >
        {getFormatLabel(format)}
      </span>
    </div>
  );
}
