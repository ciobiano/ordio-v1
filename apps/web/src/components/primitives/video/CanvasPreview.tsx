'use client';

import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useUIStore, useProcessingStore, useCaptureStore, getCanvasDimensions } from '@/stores';
import { waveformSampler } from '@Ordio/shared/waveform';
import { loadFont } from '@Ordio/engine/loaders';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import { loadGraphic } from '@Ordio/engine/loaders';
import { cn } from '@/lib/utils';
import { canvasPreviewFrame, canvasGridOverlay } from '@/lib/variants';
import { CanvasCaptionTransformOverlay } from './canvas-preview/CanvasCaptionTransformOverlay';
import { useBackgroundVideo } from './canvas-preview/useBackgroundVideo';
import { useBackgroundImage } from './canvas-preview/useBackgroundImage';
import { useCaptionGesture } from './canvas-preview/useCaptionGesture';
import { useCanvasRenderLoop } from './canvas-preview/useCanvasRenderLoop';

interface CanvasPreviewProps {
  playback: UsePlaybackReturn;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
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

export default function CanvasPreview({
  playback,
  format,
  waveformStyle,
  canvasLayout,
  showWatermark = false,
  graphicStyle,
  className,
  showGrid = false,
  gridSize = 24,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<number[]>([]);
  const currentTimeRef = useRef(0);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  const transcript = useProcessingStore((s) => s.transcript);
  const captionGroups = useProcessingStore((s) => s.captionGroups);
  const style = useUIStore((s) => s.style);
  const captionTransform = useUIStore((s) => s.captionTransform);
  const setCaptionTransform = useUIStore((s) => s.setCaptionTransform);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);

  // Load the selected font so canvas can render it, then trigger re-draw
  useEffect(() => {
    setFontLoaded(false);
    loadFont(style.fontFamily).then(() => setFontLoaded(true));
  }, [style.fontFamily]);

  const { bgVideo, bgLoading } = useBackgroundVideo(style.background, playback.isPlaying);
  const { bgImage, bgImageLoading } = useBackgroundImage(style.background);
  const backgroundFrame = bgVideo ?? bgImage ?? null;

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
  const aspectRatio = canvasWidth / canvasHeight;

  const { captionBox, drawCurrentFrame } = useCanvasRenderLoop({
    canvasRef,
    currentTimeRef,
    waveformDataRef,
    playback,
    transcript,
    style,
    canvasWidth,
    canvasHeight,
    waveformStyle,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionGroups,
    captionTransform,
    backgroundFrame,
    fontLoaded,
  });

  const showCaptionBox = captionBox !== null;

  const togglePlayback = useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else void playback.play();
  }, [playback]);

  const {
    isTransformActive,
    setIsTransformActive,
    showTransformHint,
    overlayRef,
    beginGesture,
    handleGestureMove,
    endGesture,
    handleActivationPointerUp,
    handleActivationDoubleClick,
  } = useCaptionGesture({
    canvasRef,
    canvasWidth,
    canvasHeight,
    captionTransform,
    setCaptionTransform,
    showCaptionBox,
    onActivationSingleTap: togglePlayback,
  });

  // Paused scrubbing: time listeners update displayTime, but the loop above
  // only reacts to isPlaying/draw-input changes — redraw so the frozen frame
  // tracks the playhead. No-op while playing (the rAF loop owns drawing).
  useEffect(() => {
    if (!playback.isPlaying) drawCurrentFrame();
  }, [displayTime, playback.isPlaying, drawCurrentFrame]);

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
      className={cn(canvasPreviewFrame, className)}
      onPointerDownCapture={(e) => {
        if (
          isTransformActive &&
          overlayRef.current &&
          !overlayRef.current.contains(e.target as Node)
        ) {
          setIsTransformActive(false);
        }
      }}
      style={{ '--canvas-aspect-ratio': aspectRatio } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full"
        role="img"
        tabIndex={-1}
        aria-label={`Video preview — ${getFormatLabel(format)} format, ${formatTime(playback.currentTime)} of ${formatTime(playback.duration)}`}
      />
      <CanvasCaptionTransformOverlay
        captionBox={captionBox}
        isTransformActive={isTransformActive}
        showTransformHint={showTransformHint}
        overlayRef={overlayRef}
        onActivationPointerUp={handleActivationPointerUp}
        onActivationDoubleClick={handleActivationDoubleClick}
        onBeginMove={(event) => beginGesture('move', event)}
        onBeginRotate={(event) => beginGesture('rotate', event)}
        onBeginResize={(event) => beginGesture('resize', event)}
        onGestureMove={handleGestureMove}
        onGestureEnd={endGesture}
        onHideCaptions={() => {
          setIsTransformActive(false);
          setCaptionTransform({ visible: false });
        }}
      />
      {!captionTransform.visible && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-40 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs text-white"
          onClick={() => {
            setCaptionTransform({
              visible: true,
              scale: 1,
              rotationDeg: 0,
              offsetXRatio: 0,
              offsetYRatio: 0,
            })
            setIsTransformActive(false);
          }}
        >
          Show captions
        </button>
      )}
      {/* Optional grid overlay for composition studies */}
      {showGrid && (
        <div
          aria-hidden="true"
          className={canvasGridOverlay}
          style={{ '--grid-size': `${gridSize}px` } as CSSProperties}
        />
      )}
      {/* Background loading — shown while a newly selected video or image
          background is being fetched/decoded, before it appears in the preview */}
      {(bgLoading || bgImageLoading) && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="status"
          aria-label="Loading background video"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        </div>
      )}
      {/* Format badge */}
      <div className="absolute top-2 left-2 z-20 bg-black/50 text-[clamp(0.625rem,2vw,0.75rem)] text-white/70 px-2 py-0.5 rounded-lg backdrop-blur" aria-hidden="true">
        {getFormatLabel(format)}
      </div>

      {/* Invisible full-canvas play/pause toggle (behind captions) */}
      <button
        type="button"
        aria-label={playback.isPlaying ? 'Pause preview' : 'Play preview'}
        onClick={() => (playback.isPlaying ? playback.pause() : playback.play())}
        className="absolute inset-0 z-20 w-full h-full cursor-pointer focus:outline-none"
      />

      {/* Visual center play indicator (hidden while playing, pointer-events-none to avoid conflicts) */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition-all duration-300",
          playback.isPlaying ? "scale-90 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
