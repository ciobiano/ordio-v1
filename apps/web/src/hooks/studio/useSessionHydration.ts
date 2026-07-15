'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { toast } from 'sonner';
import { useCaptureStore, useProcessingStore } from '@/stores';
import { decodeBlobToAudioBuffer } from '@/lib/media';
import type { GenericId } from 'convex/values';

interface PlaybackLoader {
  load: (buffer: AudioBuffer) => void;
}

/**
 * Loads an existing session's audio + transcript into the shared stores so
 * the Studio Edit stage can render it — mirrors the hydration effect in
 * `/create/export/[sessionId]/page.tsx`. Freshly-recorded sessions already
 * have their audioBuffer set by processAudio, so this is a no-op for them;
 * it only fires when opening a session that isn't already loaded (e.g. an
 * older clip clicked in the Library).
 */
export function useSessionHydration(sessionId: string | null, playback: PlaybackLoader) {
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const setAudioBuffer = useCaptureStore((s) => s.setAudioBuffer);
  const setAudioBlob = useCaptureStore((s) => s.setAudioBlob);
  const setAudioDuration = useCaptureStore((s) => s.setAudioDuration);
  const setTranscript = useProcessingStore((s) => s.setTranscript);

  const [isHydrating, setIsHydrating] = useState(false);

  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId: sessionId as GenericId<'sessions'> } : 'skip'
  );
  const audioUrl = useQuery(
    api.sessions.getAudioUrl,
    sessionId && session ? { sessionId: sessionId as GenericId<'sessions'> } : 'skip'
  );

  useEffect(() => {
    if (!sessionId || !session || !audioUrl || audioBuffer || isHydrating) return;

    setIsHydrating(true);

    const hydrate = async () => {
      try {
        const res = await fetch(audioUrl);
        const arrayBuf = await res.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: session.mimeType });
        const { audioBuffer: decoded } = await decodeBlobToAudioBuffer(blob);
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setTranscript(session.transcript);
      } catch {
        toast.error('Failed to load this clip.');
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrate();
  }, [sessionId, session, audioUrl, audioBuffer, isHydrating, setAudioBuffer, setAudioBlob, setAudioDuration, setTranscript]);

  // Depend on the stable `load` callback, NOT the playback object — that gets
  // a new identity every render, and re-running load() stops playback and
  // resets the playhead to 0 on every re-render (frozen preview + timeline).
  const load = playback.load;
  useEffect(() => {
    if (audioBuffer) load(audioBuffer);
  }, [audioBuffer, load]);

  return { isHydrating };
}
