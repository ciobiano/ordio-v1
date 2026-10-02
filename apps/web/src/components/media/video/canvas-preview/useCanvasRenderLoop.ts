import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { notifyError } from '@/lib/errors/notify';
import { OrdioError } from '@/lib/errors/OrdioError';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@Ordio/engine/video';
import { getCaptionStylePreset } from '@Ordio/engine';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CanvasLayout, GraphicStyleId, CaptionGroup, CaptionTransform } from '@/stores';
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
  canvasLayout?: CanvasLayout;
  showWatermark?: boolean;
  graphicStyle?: GraphicStyleId;
  captionGroups: CaptionGroup[];
  captionTransform: CaptionTransform;
  /** Decoded video frame or custom image background — whichever is active, or null for solid/gradient. */
  backgroundFrame: HTMLVideoElement | HTMLImageElement | null;
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
  canvasLayout,
  showWatermark,
  graphicStyle,
  captionGroups,
  captionTransform,
  backgroundFrame: bgFrame,
  fontLoaded,
}: UseCanvasRenderLoopArgs) {
  const [captionBox, setCaptionBox] = useState<CaptionTransformBox | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasWarnedRenderErrorRef = useRef(false);
  /** Off-screen buffer renderFrame draws into. renderFrame clears/fills the
   * background before drawing waveform/captions/etc, so an exception partway
   * through would leave the visible canvas showing a half-composited frame
   * (background repainted, rest missing) rather than the last good one —
   * canvas 2D has no rollback. Rendering here first and only blitting to the
   * visible canvas once a full frame succeeds gives real crash-freeze
   * semantics. */
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let buffer = bufferCanvasRef.current;
    if (!buffer || buffer.width !== canvasWidth || buffer.height !== canvasHeight) {
      buffer = document.createElement('canvas');
      buffer.width = canvasWidth;
      buffer.height = canvasHeight;
      bufferCanvasRef.current = buffer;
    }
    const bufferCtx = buffer.getContext('2d');
    if (!bufferCtx) return;

    try {
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
        canvasLayout,
        showWatermark,
        graphicStyle,
        captionGroups,
        captionTransform,
        backgroundFrame: bgFrame ?? undefined,
      };

      renderFrame(bufferCtx, Math.max(0, frameIndex), totalFrames, frameOptions);
      const takesFullScreen = getCaptionStylePreset(renderStyle.captionStyleId).ownsStage;
      const hasVisualZone = !takesFullScreen && (waveformStyle !== 'none' || !!graphicStyle);
      const nextCaptionBox = measureCaptionTransformBox({
        ctx: bufferCtx,
        currentTime: currentTimeRef.current,
        transcript,
        captionGroups,
        style: renderStyle,
        layout: canvasLayout ?? 'top',
        hasVisualZone,
        flipped: canvasLayout === 'flipped',
        transform: captionTransform,
      });
      setCaptionBox((prev) => (areCaptionBoxesEqual(prev, nextCaptionBox) ? prev : nextCaptionBox));

      // Full frame rendered without throwing — safe to show it.
      ctx.drawImage(buffer, 0, 0);
    } catch (err) {
      // Gated the same as the toast below — a persistent render error would
      // otherwise log up to 60x/sec since drawCurrentFrame runs every frame.
      if (!hasWarnedRenderErrorRef.current) {
        hasWarnedRenderErrorRef.current = true;
        notifyError(new OrdioError('PREVIEW_RENDER_FAILED', { cause: err }));
      }
      // Intentionally no re-throw and no drawImage this tick — the visible
      // canvas keeps showing whatever the last successful blit painted.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.duration, transcript, style, canvasWidth, canvasHeight, waveformStyle, canvasLayout, showWatermark, graphicStyle, captionGroups, captionTransform, fontLoaded, bgFrame]);

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
