'use client';

import { useState, useRef, useCallback } from 'react';
import type { Word } from '@Ordio/shared/schemas';

export interface UseTranscriptionReturn {
  isTranscribing: boolean;
  transcript: Word[];
  liveWords: string[];
  error: string | null;
  isSupported: boolean;
  startLiveTranscription: () => void;
  stopLiveTranscription: () => void;
  transcribeAudio: (blob: Blob) => Promise<Word[]>;
  clearTranscript: () => void;
}

// Minimal types for cross-browser SpeechRecognition
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { transcript: string };
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly resultIndex: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
    | SpeechRecognitionConstructor
    | undefined;
  return Ctor ?? null;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [liveWords, setLiveWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const startTimeRef = useRef<number>(0);

  const SpeechRecognitionAPI = getSpeechRecognitionConstructor();
  const isSupported = SpeechRecognitionAPI !== null;

  const startLiveTranscription = useCallback(
    () => {
      const API = getSpeechRecognitionConstructor();
      if (!API) {
        setError('Speech recognition is not supported in this browser.');
        return;
      }

      try {
        setError(null);
        startTimeRef.current = Date.now();

        const recognition = new API();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognitionRef.current = recognition;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const interimWords: string[] = [];

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0].transcript.trim();

            if (result.isFinal) {
              const elapsed = (Date.now() - startTimeRef.current) / 1000;
              const wordList = text.split(/\s+/).filter(Boolean);
              const wordDuration = elapsed / Math.max(wordList.length, 1);

              const finalWords: Word[] = wordList.map((word, idx) => ({
                text: word,
                start: Math.max(
                  0,
                  elapsed - wordDuration * (wordList.length - idx)
                ),
                end: elapsed - wordDuration * (wordList.length - idx - 1),
              }));

              setTranscript((prev) => [...prev, ...finalWords]);
            } else {
              interimWords.push(...text.split(/\s+/).filter(Boolean));
            }
          }

          if (interimWords.length > 0) {
            setLiveWords((prev) => [...prev.slice(-40), ...interimWords]);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error !== 'no-speech') {
            setError(`Transcription error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsTranscribing(false);
        };

        recognition.start();
        setIsTranscribing(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to start transcription'
        );
      }
    },
    []
  );

  const stopLiveTranscription = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsTranscribing(false);
  }, []);

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
    setLiveWords([]);
    setError(null);
  }, []);

  return {
    isTranscribing,
    transcript,
    liveWords,
    error,
    isSupported,
    startLiveTranscription,
    stopLiveTranscription,
    transcribeAudio,
    clearTranscript,
  };
}
