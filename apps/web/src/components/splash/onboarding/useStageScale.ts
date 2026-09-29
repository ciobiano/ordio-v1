'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scale a fixed-size illustration stage to fit whatever room its container
 * has, never above 1 and never below `min`. Measured rather than written as a
 * media query because the room left over depends on everything else in the
 * column — headline wrap, browser toolbars — not on the viewport alone.
 */
export function useStageScale(stageW: number, stageH: number, min = 0.5) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.max(min, Math.min(1, height / stageH, width / stageW)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stageW, stageH, min]);

  return { ref, scale };
}
