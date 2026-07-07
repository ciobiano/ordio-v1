// apps/web/src/components/soul/capture/useMockLiveCaption.ts
//
// Mocked live caption: cycles canned phrases word-by-word while `isSpeaking` is true, mirroring
// the Claude Design mockup's fake typewriter caption. This exists so the Capture screen's UI and
// animation are ready before real streaming transcription is built — see the "Real-time live
// captioning during recording" entry in TODOS.md. When that lands, this hook is the only file
// that needs to change; nothing else in the capture/ family should know it's a mock.
'use client';

import { useEffect, useRef, useState } from 'react';

const CAPTION_PHRASES = [
  'so today I wanted to talk about the roadmap',
  'and figure out what ships next quarter',
  'let us also loop in design before friday',
  'I think the onboarding flow needs one more pass',
];

const WORD_INTERVAL_MS = 260;
const PHRASE_GAP_MS = 900;

export function useMockLiveCaption(isSpeaking: boolean): string {
  const [caption, setCaption] = useState('');
  const phraseIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSpeaking) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setCaption('');
      return;
    }

    const stepThroughPhrase = () => {
      const phrase = CAPTION_PHRASES[phraseIndexRef.current % CAPTION_PHRASES.length];
      const words = phrase.split(' ');
      let wordIndex = 0;

      const revealNextWord = () => {
        wordIndex++;
        setCaption(words.slice(0, wordIndex).join(' '));
        if (wordIndex < words.length) {
          timerRef.current = setTimeout(revealNextWord, WORD_INTERVAL_MS);
        } else {
          phraseIndexRef.current += 1;
          timerRef.current = setTimeout(stepThroughPhrase, PHRASE_GAP_MS);
        }
      };

      timerRef.current = setTimeout(revealNextWord, WORD_INTERVAL_MS);
    };

    stepThroughPhrase();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [isSpeaking]);

  return caption;
}
