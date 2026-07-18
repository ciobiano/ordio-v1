import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@Ordio/engine/video';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, GraphicStyleId, CaptionGroup, CaptionTransform } from '@/stores';
import {
  measureCaptionTransformBox,
  type CaptionTransformBox,
} from './captionTransformGeometry';

interface UseCanvasRenderLoopArgs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  currentTimeRef: RefObject<number>;
  waveformDataRef: RefObject<number[]>;
  playback: UsePlaybackReturn;
  transcript: FrameOptions['transcript'];
  style: FrameOptions['style'];
  canvasWidth: number;
  canvasHeight: number;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  canvasLayout?: CanvasLayout;
  showWatermark?: boolean;
  graphicStyle?: GraphicStyleId;
  captionGroups: CaptionGroup[];
  captionAnimation: FrameOptions['captionAnimation'];
  captionTransform: CaptionTransform;
  bgVideo: HTMLVideoElement | null;
  /** Unused directly — forces a redraw once the selected font finishes loading. */
  fontLoaded: boolean;
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

/**
 * Drives the RAF render loop that paints each canvas frame (preview == export,
 * same composite path) and derives the caption bounding box the transform
 * overlay positions itself against.
 */
export function useCanvasRenderLoop({
  canvasRef,
  currentTimeRef,
  waveformDataRef,
  playback,
  transcript,
  style,
  canvasWidth,
  canvasHeight,
  waveformStyle,
  captionMode,
  canvasLayout,
  showWatermark,
  graphicStyle,
  captionGroups,
  captionAnimation,
  captionTransform,
  bgVideo,
  fontLoaded,
}: UseCanvasRenderLoopArgs) {
  const [captionBox, setCaptionBox] = useState<CaptionTransformBox | null>(null);
  const rafRef = useRef<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, captionMode, canvasLayout, showWatermark, graphicStyle, captionGroups, captionAnimation, captionTransform, fontLoaded, bgVideo]);

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

  return { captionBox, drawCurrentFrame };
}
