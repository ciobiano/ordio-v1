'use client';

import { useState, useCallback } from 'react';
import type { Word } from '@Ordio/shared/schemas';
import { transcriptionErrorFor } from '@/lib/transcription/insufficientCredits';
import { toOrdioError } from '@/lib/errors/OrdioError';

export interface UseTranscriptionReturn {
  isTranscribing: boolean;
  transcript: Word[];
  error: string | null;
  /**
   * `durationSec` sizes the credit hold. It is not trusted — the server
   * reconciles against the duration Whisper reports — but passing it means an
   * honest caller's hold matches what they actually spend.
   */
  transcribeAudio: (blob: Blob, durationSec?: number) => Promise<Word[]>;
  clearTranscript: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [error, setError] = useState<string | null>(null);

  const transcribeAudio = useCallback(async (blob: Blob, durationSec?: number): Promise<Word[]> => {
    setIsTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob);
      if (durationSec !== undefined && Number.isFinite(durationSec)) {
        formData.append('durationSec', String(durationSec));
      }

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body: unknown = await res.json().catch(() => ({}));
        // Out of credits is its own error type — callers show an upgrade
        // prompt for it rather than offering a retry that cannot succeed.
        throw transcriptionErrorFor(res.status, body);
      }

      const { words } = (await res.json()) as { words: Word[] };
      setTranscript(words);
      return words;
    } catch (err) {
      // A rejected fetch becomes a connection error here, not "failed".
      const normalizedError = toOrdioError(err, 'TRANSCRIBE_FAILED');
      setError(normalizedError.message);
      throw normalizedError;
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
