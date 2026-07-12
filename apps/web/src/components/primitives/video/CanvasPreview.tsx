'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useUIStore, useProcessingStore, useCaptureStore, getCanvasDimensions } from '@/stores';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@/lib/video';
import { loadFont } from '@/lib/loaders';
import { loadCuratedBackground, loadCustomBackground } from '@/lib/loaders/backgroundLoader';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import { loadGraphic } from '@/lib/loaders';
import { cn } from '@/lib/utils';
import { CanvasCaptionTransformOverlay } from './canvas-preview/CanvasCaptionTransformOverlay';
import {
  measureCaptionTransformBox,
  type CaptionTransformBox,
} from './canvas-preview/captionTransformGeometry';
import {
  isCaptionActivationDoubleTap,
  type CaptionActivationTap,
} from './canvas-preview/captionActivationGesture';

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

function areCaptionBoxesEqual(a: CaptionTransformBox | null, b: CaptionTransformBox | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    Math.abs(a.centerX - b.centerX) < 0.5 &&
    Math.abs(a.centerY - b.centerY) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    Math.abs(a.rotationDeg - b.rotationDeg) < 0.1
  );
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
  const [isTransformActive, setIsTransformActive] = useState(false);
  const [showTransformHint, setShowTransformHint] = useState(true);
  const [captionBox, setCaptionBox] = useState<CaptionTransformBox | null>(null);
  const activationTapRef = useRef<CaptionActivationTap | null>(null);

  const transcript = useProcessingStore((s) => s.transcript);
  const captionGroups = useProcessingStore((s) => s.captionGroups);
  const style = useUIStore((s) => s.style);
  const captionAnimation = useUIStore((s) => s.captionAnimation);
  const captionTransform = useUIStore((s) => s.captionTransform);
  const setCaptionTransform = useUIStore((s) => s.setCaptionTransform);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);

  // Load the selected font so canvas can render it, then trigger re-draw
  useEffect(() => {
    setFontLoaded(false);
    loadFont(style.fontFamily).then(() => setFontLoaded(true));
  }, [style.fontFamily]);

  // Video background: load + autoplay the loop, draw it into renderFrame per
  // tick (same composite path as export — preview == export, scrim included).
  const background = style.background;
  const bgIsVideo = background?.type === 'video';
  const bgSource = bgIsVideo ? background.source : null;
  const bgAssetId = bgIsVideo ? background.assetId : null;
  const customBgUrl = useQuery(
    api.backgrounds.getBackgroundUrl,
    bgIsVideo && bgSource === 'custom'
      ? { assetId: bgAssetId as GenericId<'backgroundAssets'> }
      : 'skip'
  );
  const [bgVideo, setBgVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!bgIsVideo || !bgAssetId) {
      setBgVideo(null);
      return;
    }
    const loadPromise =
      bgSource === 'curated'
        ? loadCuratedBackground(bgAssetId)
        : customBgUrl
          ? loadCustomBackground(bgAssetId, customBgUrl)
          : null;
    if (!loadPromise) return; // custom URL still resolving

    loadPromise
      .then((video) => {
        if (cancelled) return;
        void video.play().catch(() => {});
        setBgVideo(video);
      })
      .catch(() => {
        // Asset failed to load — fall back to solid color, never a broken preview
        if (!cancelled) setBgVideo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bgIsVideo, bgSource, bgAssetId, customBgUrl]);

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

    const renderStyle = { ...style, width: canvasWidth, height: canvasHeight };
    const frameOptions: FrameOptions = {
      waveformData: waveformDataRef.current,
      transcript,
      style: renderStyle,
      waveformStyle,
      captionMode,
      canvasLayout,
      showWatermark,
      graphicStyle,
      captionGroups,
      captionAnimation,
      captionTransform,
      backgroundFrame: bgVideo ?? undefined,
    };

    renderFrame(ctx, Math.max(0, frameIndex), totalFrames, frameOptions);
    const hasVisualZone = captionMode !== 'karaoke' && (waveformStyle !== 'none' || !!graphicStyle);
    const nextCaptionBox = measureCaptionTransformBox({
      ctx,
      currentTime: currentTimeRef.current,
      transcript,
      captionGroups,
      style: renderStyle,
      layout: canvasLayout ?? 'top',
      hasVisualZone,
      flipped: canvasLayout === 'flipped',
      transform: captionTransform,
      captionMode,
    });
    setCaptionBox((prev) => (areCaptionBoxesEqual(prev, nextCaptionBox) ? prev : nextCaptionBox));
  }, [playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionMode, canvasLayout, showWatermark, graphicStyle, captionGroups, captionAnimation, captionTransform, fontLoaded, bgVideo]);

  const showCaptionBox = captionBox !== null;

  const gestureRef = useRef<{
    mode: 'move' | 'resize' | 'rotate';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetXRatio: number;
    startOffsetYRatio: number;
    startScale: number;
    startRotationDeg: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getCanvasDisplaySize = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      width: Math.max(1, rect?.width ?? canvasWidth),
      height: Math.max(1, rect?.height ?? canvasHeight),
    };
  }, [canvasHeight, canvasWidth]);

  const beginGesture = useCallback((mode: 'move' | 'resize' | 'rotate', e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = {
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetXRatio: captionTransform.offsetXRatio,
      startOffsetYRatio: captionTransform.offsetYRatio,
      startScale: captionTransform.scale,
      startRotationDeg: captionTransform.rotationDeg,
    };
  }, [captionTransform]);

  const handleGestureMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    const dx = e.clientX - gesture.startClientX;
    const dy = e.clientY - gesture.startClientY;
    const displaySize = getCanvasDisplaySize();

    if (gesture.mode === 'move') {
      setCaptionTransform({
        offsetXRatio: Math.max(-0.45, Math.min(0.45, gesture.startOffsetXRatio + dx / displaySize.width)),
        offsetYRatio: Math.max(-0.45, Math.min(0.45, gesture.startOffsetYRatio + dy / displaySize.height)),
      });
      return;
    }

    if (gesture.mode === 'resize') {
      const nextScale =
        gesture.startScale +
        (dx / displaySize.width + dy / displaySize.height) * 1.2;
      setCaptionTransform({ scale: Math.max(0.45, Math.min(2.8, nextScale)) });
      return;
    }

    const nextRotation = gesture.startRotationDeg + dx * 0.35;
    setCaptionTransform({ rotationDeg: nextRotation });
  }, [getCanvasDisplaySize, setCaptionTransform]);

  const endGesture = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!showCaptionBox) {
      setIsTransformActive(false);
    }
  }, [showCaptionBox]);

  useEffect(() => {
    if (!showCaptionBox || isTransformActive) {
      setShowTransformHint(false);
      return;
    }
    setShowTransformHint(true);
    const timer = window.setTimeout(() => setShowTransformHint(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showCaptionBox, isTransformActive]);

  const activateTransform = useCallback(() => {
    if (!showCaptionBox) return;
    activationTapRef.current = null;
    setIsTransformActive(true);
  }, [showCaptionBox]);

  const handleActivationPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.pointerType === 'mouse') {
      return;
    }

    const previousTap = activationTapRef.current;
    const nextTap: CaptionActivationTap = {
      timestamp: event.timeStamp,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    activationTapRef.current = nextTap;

    if (isCaptionActivationDoubleTap(previousTap, nextTap)) {
      activateTransform();
    }
  }, [activateTransform]);

  const handleActivationDoubleClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activateTransform();
  }, [activateTransform]);

  // Render loop: animate during playback — or whenever a video background is
  // live, so the loop keeps moving while audio is paused.
  useEffect(() => {
    if (playback.isPlaying || bgVideo) {
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
  }, [playback.isPlaying, drawCurrentFrame, bgVideo]);

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
        'relative rounded-xl overflow-hidden w-full',
        className
      )}
      onPointerDownCapture={(e) => {
        if (
          isTransformActive &&
          overlayRef.current &&
          !overlayRef.current.contains(e.target as Node)
        ) {
          setIsTransformActive(false);
        }
      }}
      style={{
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.42)',
        animation: 'fadeIn 0.2s ease-out',
        aspectRatio: aspectRatio,
        transition: 'aspect-ratio 0.3s ease-out',
      }}
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
      {showGrid && <div aria-hidden="true" style={gridOverlayStyle} />}
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
