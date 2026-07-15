'use client';

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CropIcon,
  Delete02Icon,
  Rotate02Icon,
} from '@hugeicons/core-free-icons';
import type { CaptionTransformBox } from './captionTransformGeometry';

type CanvasCaptionTransformOverlayProps = {
  captionBox: CaptionTransformBox | null;
  isTransformActive: boolean;
  showTransformHint: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  onActivationPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onActivationDoubleClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onBeginMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginRotate: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onGestureMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onGestureEnd: (event: ReactPointerEvent<HTMLElement>) => void;
  onHideCaptions: () => void;
};

export function CanvasCaptionTransformOverlay({
  captionBox,
  isTransformActive,
  showTransformHint,
  overlayRef,
  onActivationPointerUp,
  onActivationDoubleClick,
  onBeginMove,
  onBeginRotate,
  onBeginResize,
  onGestureMove,
  onGestureEnd,
  onHideCaptions,
}: CanvasCaptionTransformOverlayProps) {
  if (!captionBox) return null;

  if (!isTransformActive) {
    return (
      <>
        <button
          type="button"
          aria-label="Edit captions"
          onPointerUp={onActivationPointerUp}
          onDoubleClick={onActivationDoubleClick}
          className="absolute z-40 touch-manipulation rounded-xl bg-transparent"
          style={captionBox.style}
        >
          <span className="sr-only">Edit captions</span>
        </button>
        {showTransformHint && (
          <div
            className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-xl"
            aria-hidden="true"
          >
            <span>Double-tap or double-click captions to edit</span>
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
        ...captionBox.style,
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
        className="absolute -left-4.5 -top-4.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onHideCaptions();
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} size={14} />
      </button>
      <button
        type="button"
        className="absolute -right-4.5 -top-4.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => {
          event.stopPropagation();
          onBeginRotate(event);
        }}
        onPointerMove={onGestureMove}
        onPointerUp={onGestureEnd}
        onPointerCancel={onGestureEnd}
        aria-label="Rotate captions"
      >
        <HugeiconsIcon icon={Rotate02Icon} size={14} />
      </button>
      <button
        type="button"
        className="absolute -right-4.5 -bottom-4.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/88 text-white shadow-lg backdrop-blur-xl"
        onPointerDown={(event) => {
          event.stopPropagation();
          onBeginResize(event);
        }}
        onPointerMove={onGestureMove}
        onPointerUp={onGestureEnd}
        onPointerCancel={onGestureEnd}
        aria-label="Resize captions"
      >
        <HugeiconsIcon icon={CropIcon} size={14} />
      </button>
    </div>
  );
}
