'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CropIcon,
  Delete02Icon,
  Edit02Icon,
  Rotate02Icon,
} from '@hugeicons/core-free-icons';

type CanvasCaptionTransformOverlayProps = {
  showCaptionBox: boolean;
  isTransformActive: boolean;
  showTransformHint: boolean;
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
  boxPxWidth: number;
  boxPxHeight: number;
  rotationDeg: number;
  overlayRef: RefObject<HTMLDivElement | null>;
  onActivateTransform: () => void;
  onHotspotPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onBeginMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginRotate: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onGestureMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onGestureEnd: (event: ReactPointerEvent<HTMLElement>) => void;
  onHideCaptions: () => void;
};

function getOverlayBoxStyle(props: {
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
  boxPxWidth: number;
  boxPxHeight: number;
  rotationDeg: number;
}) {
  const {
    centerX,
    centerY,
    canvasWidth,
    canvasHeight,
    boxPxWidth,
    boxPxHeight,
    rotationDeg,
  } = props;

  return {
    left: `${(centerX / canvasWidth) * 100}%`,
    top: `${(centerY / canvasHeight) * 100}%`,
    width: `${(boxPxWidth / canvasWidth) * 100}%`,
    height: `${(boxPxHeight / canvasHeight) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
  };
}

export function CanvasCaptionTransformOverlay({
  showCaptionBox,
  isTransformActive,
  showTransformHint,
  centerX,
  centerY,
  canvasWidth,
  canvasHeight,
  boxPxWidth,
  boxPxHeight,
  rotationDeg,
  overlayRef,
  onActivateTransform,
  onHotspotPointerUp,
  onBeginMove,
  onBeginRotate,
  onBeginResize,
  onGestureMove,
  onGestureEnd,
  onHideCaptions,
}: CanvasCaptionTransformOverlayProps) {
  if (!showCaptionBox) return null;

  const boxStyle = getOverlayBoxStyle({
    centerX,
    centerY,
    canvasWidth,
    canvasHeight,
    boxPxWidth,
    boxPxHeight,
    rotationDeg,
  });

  if (!isTransformActive) {
    return (
      <>
        <button
          type="button"
          aria-label="Edit captions"
          onDoubleClick={onActivateTransform}
          onPointerUp={onHotspotPointerUp}
          className="absolute z-40 touch-manipulation rounded-2xl bg-white/[0.04]"
          style={boxStyle}
        >
          <span className="sr-only">Double tap or double click to edit captions</span>
        </button>
        {showTransformHint && (
          <div
            className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-xl"
            aria-hidden="true"
          >
            <HugeiconsIcon icon={Edit02Icon} size={14} />
            <span>Double-tap captions to edit</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="absolute z-40 touch-none"
      style={{
        ...boxStyle,
        border: '1px solid rgba(255,255,255,0.95)',
        borderRadius: 8,
        boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
      }}
      onPointerDown={onBeginMove}
      onPointerMove={onGestureMove}
      onPointerUp={onGestureEnd}
      onPointerCancel={onGestureEnd}
    >
      <button
        type="button"
        aria-label="Delete captions"
        className="absolute -left-5 -top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onHideCaptions();
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} size={10} />
      </button>
      <button
        type="button"
        className="absolute -right-5 -top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => {
          event.stopPropagation();
          onBeginRotate(event);
        }}
        aria-label="Rotate captions"
      >
        <HugeiconsIcon icon={Rotate02Icon} size={10} />
      </button>
      <button
        type="button"
        className="absolute -right-5 -bottom-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => {
          event.stopPropagation();
          onBeginResize(event);
        }}
        aria-label="Resize captions"
      >
        <HugeiconsIcon icon={CropIcon} size={10} />
      </button>
    </div>
  );
}
