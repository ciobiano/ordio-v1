import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { CaptionTransform } from '@/stores';
import {
  isCaptionActivationDoubleTap,
  type CaptionActivationTap,
} from './captionActivationGesture';

type GestureMode = 'move' | 'resize' | 'rotate';

interface GestureState {
  mode: GestureMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetXRatio: number;
  startOffsetYRatio: number;
  startScale: number;
  startRotationDeg: number;
}

interface UseCaptionGestureArgs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  captionTransform: CaptionTransform;
  setCaptionTransform: (transform: Partial<CaptionTransform>) => void;
  showCaptionBox: boolean;
}

/**
 * Drag-to-move / drag-to-resize / drag-to-rotate for the caption box, plus
 * the double-tap (touch) / double-click (mouse) gesture that activates the
 * transform handles in the first place.
 */
export function useCaptionGesture({
  canvasRef,
  canvasWidth,
  canvasHeight,
  captionTransform,
  setCaptionTransform,
  showCaptionBox,
}: UseCaptionGestureArgs) {
  const [isTransformActive, setIsTransformActive] = useState(false);
  const [showTransformHint, setShowTransformHint] = useState(true);
  const gestureRef = useRef<GestureState | null>(null);
  const activationTapRef = useRef<CaptionActivationTap | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getCanvasDisplaySize = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      width: Math.max(1, rect?.width ?? canvasWidth),
      height: Math.max(1, rect?.height ?? canvasHeight),
    };
  }, [canvasRef, canvasHeight, canvasWidth]);

  const beginGesture = useCallback((mode: GestureMode, e: ReactPointerEvent<HTMLElement>) => {
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

  return {
    isTransformActive,
    setIsTransformActive,
    showTransformHint,
    overlayRef,
    beginGesture,
    handleGestureMove,
    endGesture,
    handleActivationPointerUp,
    handleActivationDoubleClick,
  };
}
