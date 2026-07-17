'use client';

import { useEffect, useRef, useState } from 'react';

const TYPE_INTERVAL_MS = 42;
const DELETE_INTERVAL_MS = 26;
const HOLD_MS = 2000;
const PHRASE_GAP_MS = 320;

interface TypewriterState {
  text: string;
  /** True while fully typed and holding, before deletion starts. */
  isPhraseComplete: boolean;
}

/**
 * Type/hold/delete/cycle through a phrase list forever while `active`. Same
 * cadence as the capture screen's idle prompt (see useIdleTypewriter) — this
 * is that rhythm, generalized to any phrase list and any active-toggle.
 */
export function useTypewriter(phrases: string[], active: boolean): TypewriterState {
  const [state, setState] = useState<TypewriterState>({ text: '', isPhraseComplete: false });
  const phraseIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const deletingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || phrases.length === 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setState({ text: '', isPhraseComplete: false });
      return;
    }

    phraseIndexRef.current = 0;
    charIndexRef.current = 0;
    deletingRef.current = false;

    const step = () => {
      const phrase = phrases[phraseIndexRef.current];
      let delay: number;

      if (!deletingRef.current) {
        charIndexRef.current++;
        const complete = charIndexRef.current >= phrase.length;
        setState({ text: phrase.slice(0, charIndexRef.current), isPhraseComplete: complete });
        if (complete) {
          deletingRef.current = true;
          delay = HOLD_MS;
        } else {
          delay = TYPE_INTERVAL_MS;
        }
      } else {
        charIndexRef.current--;
        setState({ text: phrase.slice(0, charIndexRef.current), isPhraseComplete: false });
        if (charIndexRef.current <= 0) {
          deletingRef.current = false;
          phraseIndexRef.current = (phraseIndexRef.current + 1) % phrases.length;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phrases is expected to be a stable/module-level array
  }, [active]);

  return state;
}
