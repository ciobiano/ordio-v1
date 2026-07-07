// apps/web/src/components/soul/capture/useIdleTypewriter.ts
'use client';

import { useEffect, useRef, useState } from 'react';

const IDLE_PHRASES = ['Press and hold to record', 'speak your truth'];
const TYPE_INTERVAL_MS = 42;
const DELETE_INTERVAL_MS = 26;
const HOLD_MS = 2000;
const PHRASE_GAP_MS = 320;

export function useIdleTypewriter(active: boolean): string {
  const [text, setText] = useState('');
  const phraseIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const deletingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setText('');
      return;
    }

    phraseIndexRef.current = 0;
    charIndexRef.current = 0;
    deletingRef.current = false;

    const step = () => {
      const phrase = IDLE_PHRASES[phraseIndexRef.current];
      let delay: number;

      if (!deletingRef.current) {
        charIndexRef.current++;
        setText(phrase.slice(0, charIndexRef.current));
        if (charIndexRef.current >= phrase.length) {
          deletingRef.current = true;
          delay = HOLD_MS;
        } else {
          delay = TYPE_INTERVAL_MS;
        }
      } else {
        charIndexRef.current--;
        setText(phrase.slice(0, charIndexRef.current));
        if (charIndexRef.current <= 0) {
          deletingRef.current = false;
          phraseIndexRef.current = (phraseIndexRef.current + 1) % IDLE_PHRASES.length;
          delay = PHRASE_GAP_MS;
        } else {
          delay = DELETE_INTERVAL_MS;
        }
      }

      timerRef.current = setTimeout(step, delay);
    };

    timerRef.current = setTimeout(step, TYPE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [active]);

  return text;
}
