'use client';

import { useState, useCallback } from 'react';
import type { Word } from '@Ordio/shared/schemas';
import { transcribeStoredAudio } from '@/lib/transcription/storedAudio';
import { toOrdioError } from '@/lib/errors/OrdioError';

export interface UseTranscriptionReturn {
  isTranscribing: boolean;
  transcript: Word[];
  error: string | null;
  /**
   * Transcribe audio already uploaded to storage, by its storage ID.
   *
   * `durationSec` sizes the credit hold. It is not trusted — the server
   * reconciles against the duration Whisper reports — but passing it means an
   * honest caller's hold matches what they actually spend.
   */
  transcribeAudio: (storageId: string, durationSec?: number) => Promise<Word[]>;
  clearTranscript: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [error, setError] = useState<string | null>(null);

  const transcribeAudio = useCallback(async (storageId: string, durationSec?: number): Promise<Word[]> => {
    setIsTranscribing(true);
    setError(null);
    try {
      // Out of credits arrives as its own error type — callers show an upgrade
      // prompt for it rather than offering a retry that cannot succeed.
      const words = await transcribeStoredAudio(storageId, durationSec);
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
