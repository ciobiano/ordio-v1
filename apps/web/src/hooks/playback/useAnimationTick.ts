'use client';

import { useEffect, useRef, useState } from 'react';

/** rAF-driven tick — pure, no Date.now() in render */
export function useAnimationTick(active: boolean): number {
  const [tick, setTick] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const step = () => {
      setTick((t) => t + 1);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  return tick;
}
