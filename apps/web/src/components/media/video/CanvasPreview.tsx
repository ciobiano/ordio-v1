'use client';

import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useUIStore, useProcessingStore, useCaptureStore, getCanvasDimensions } from '@/stores';
import { waveformSampler } from '@Ordio/shared/waveform';
import { loadFont } from '@Ordio/engine/loaders';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import { HugeiconsIcon } from '@hugeicons/react';
import { FlipVerticalIcon } from '@hugeicons/core-free-icons';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
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
  onLocked?: (feature: FeatureKey) => void;
  /**
   * Drop the centre play badge. Set while a bottom panel has the stage running
   * at reduced height, where a 56px disc over a small canvas covers the artwork
   * it is meant to sit on. Only the badge goes — it is decorative
   * (`aria-hidden`, `pointer-events-none`) and the full-canvas tap target
   * underneath is untouched, so tapping the stage still plays.
   */
  hidePlayBadge?: boolean;
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
  onLocked,
  hidePlayBadge = false,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeCanvasLayout = useUIStore((s) => s.canvasLayout);
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout);
  const { isLocked } = useFeatureGates();
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

  // Quick toggle for canvas layout (Upper/Lower) — a binary property of the
  // canvas itself, so it lives on the canvas rather than in a panel. This is
  // now the only way to flip: StageControlBar carried the desktop equivalent
  // and was removed once its other controls moved into the Style tabs.
  const layoutFlipped = storeCanvasLayout === 'flipped';
  const handleFlipStage = useCallback(() => {
    if (!layoutFlipped && isLocked('layout_flipped')) {
      onLocked?.('layout_flipped');
      return;
    }
    setCanvasLayout(layoutFlipped ? 'top' : 'flipped');
  }, [layoutFlipped, isLocked, onLocked, setCanvasLayout]);

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
          // Was px-3 py-1 text-xs — a ~24px target, and the only way back once
          // captions are hidden, so missing it looks like the captions are gone
          // for good. Sized and coloured off the system rather than the raw
          // black/white it was carrying.
          className={cn(
            'absolute bottom-3 right-3 z-40 flex h-11 items-center rounded-full px-4',
            'border border-white/20 bg-black/70 text-[13px] font-semibold text-[color:var(--acid-text-1)]',
            'backdrop-blur transition-colors hover:bg-black/80'
          )}
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

      {/* Stage flip — direct tap, no panel */}
      <button
        type="button"
        onClick={handleFlipStage}
        aria-pressed={layoutFlipped}
        aria-label={layoutFlipped ? 'Flip stage to upper' : 'Flip stage to lower'}
        className={cn(
          'absolute top-2 right-2 z-40 flex h-7 w-7 items-center justify-center rounded-lg',
          'bg-black/50 text-white/70 backdrop-blur transition-colors hover:bg-black/65 hover:text-white',
          // The disc stays 28px so it does not crowd the artwork, but the target
          // it presents to a thumb is 48px. Same pattern the caption transform
          // handles use.
          'after:absolute after:-inset-2.5 after:content-[""]'
        )}
      >
        <HugeiconsIcon icon={FlipVerticalIcon} size={14} strokeWidth={2} />
      </button>

      {/* Invisible full-canvas play/pause toggle (behind captions) */}
      <button
        type="button"
        aria-label={playback.isPlaying ? 'Pause preview' : 'Play preview'}
        onClick={() => (playback.isPlaying ? playback.pause() : playback.play())}
        className="absolute inset-0 z-20 w-full h-full cursor-pointer focus:outline-none"
      />

      {/* Visual centre play indicator. Purely decorative — the tap target is the
          full-canvas button above, so this fading out never costs an action.
          Hidden while playing, and while a panel has the stage shrunk, where a
          56px disc covers most of the artwork it is sitting on. Faded rather
          than unmounted so it eases out with the canvas resize. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition-all duration-300 motion-reduce:transition-none",
          playback.isPlaying || hidePlayBadge ? "scale-90 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
