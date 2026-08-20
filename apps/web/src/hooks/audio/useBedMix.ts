'use client';

/**
 * The voice with the bed mixed under it.
 *
 * One buffer serves both consumers, because both take the same thing: preview
 * plays an AudioBuffer, and `startExport` encodes one. Mixing separately for
 * each is how a bed ends up sounding one way in the editor and another in the
 * file — the bug this hook exists to make impossible.
 *
 * Returns the voice untouched when there is no bed, so nothing downstream has
 * to know whether a mix happened.
 */

import { useEffect, useRef, useState } from 'react';
import type { Word } from '@Ordio/shared';
import { useCaptureStore } from '@/stores';
import type { BedClip } from '@/lib/audio/bedGeometry';
import { mixBedIntoVoice } from '@/lib/audio/mixBed';

/**
 * How long the controls must be still before a re-mix starts.
 *
 * Rendering is offline but not free — it walks the whole clip — and a level
 * slider fires continuously. Without this, dragging one queues a render per
 * frame and the last to finish wins, which is not necessarily the last one
 * requested.
 */
const SETTLE_MS = 260;

interface UseBedMixArgs {
  bed: BedClip | null;
  voiceLevel: number;
  musicLevel: number;
  duck: boolean;
  words: Word[];
}

export function useBedMix({ bed, voiceLevel, musicLevel, duck, words }: UseBedMixArgs) {
  const voice = useCaptureStore((s) => s.audioBuffer);
  const [mixed, setMixed] = useState<AudioBuffer | null>(null);
  const [mixing, setMixing] = useState(false);

  /* Decoding the dropped file is the expensive half and depends only on the
     file, so it is cached against the object URL rather than redone for every
     trim. */
  const decoded = useRef<{ url: string; buffer: AudioBuffer } | null>(null);

  /* Only the newest render may publish. An earlier, slower one resolving
     afterwards would overwrite the current settings with stale audio. */
  const generation = useRef(0);

  useEffect(() => {
    if (!voice) {
      setMixed(null);
      return;
    }
    if (!bed) {
      setMixed(voice);
      return;
    }

    const mine = ++generation.current;
    const timer = window.setTimeout(async () => {
      setMixing(true);
      try {
        if (decoded.current?.url !== bed.url) {
          const bytes = await (await fetch(bed.url)).arrayBuffer();
          const context = new OfflineAudioContext(1, 1, voice.sampleRate);
          decoded.current = { url: bed.url, buffer: await context.decodeAudioData(bytes) };
        }
        const bedBuffer = decoded.current.buffer;

        const next = await mixBedIntoVoice({
          voice,
          bed,
          bedBuffer,
          voiceLevel,
          musicLevel,
          duck,
          words,
        });
        if (generation.current === mine) setMixed(next);
      } catch (err) {
        console.error('[useBedMix]', err);
        /* Fall back to the bare voice rather than leaving the editor with
           nothing to play — a failed mix must not silence the clip. */
        if (generation.current === mine) setMixed(voice);
      } finally {
        if (generation.current === mine) setMixing(false);
      }
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [voice, bed, voiceLevel, musicLevel, duck, words]);

  return { mixed, mixing };
}
