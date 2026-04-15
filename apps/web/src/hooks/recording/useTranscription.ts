'use client';

import { useState, useCallback } from 'react';
import type { Word } from '@Ordio/shared/schemas';

export interface UseTranscriptionReturn {
  isTranscribing: boolean;
  transcript: Word[];
  error: string | null;
  transcribeAudio: (blob: Blob) => Promise<Word[]>;
  clearTranscript: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [error, setError] = useState<string | null>(null);

  const transcribeAudio = useCallback(async (blob: Blob): Promise<Word[]> => {
    setIsTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '381f43' },
        body: JSON.stringify({
          sessionId: '381f43',
          runId: 'post-fix',
          location: 'useTranscription.ts:transcribeAudio:response',
          message: '/api/transcribe response',
          data: {
            ok: res.ok,
            status: res.status,
            sentMime: blob.type,
            sentSize: blob.size,
          },
          timestamp: Date.now(),
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(body.error ?? `Transcription failed (${res.status})`);
      }

      const { words } = (await res.json()) as { words: Word[] };
      setTranscript(words);
      return words;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      setError(message);
      return [];
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setError(null);
  }, []);

  return {
    isTranscribing,
    transcript,
    error,
    transcribeAudio,
    clearTranscript,
  };
}
