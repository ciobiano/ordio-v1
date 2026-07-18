'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface UseVADReturn {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
}

/**
 * Voice Activity Detection hook using @ricky0123/vad-react.
 * Dynamically imports the VAD module to avoid SSR issues.
 * Only provides isSpeaking state for visual feedback — does not capture audio.
 *
 * Reuses the caller's already-granted `stream` (via getStream/pauseStream/
 * resumeStream) instead of letting MicVAD open its own getUserMedia — a
 * second independent mic request here is what was causing Safari to
 * re-prompt for permission every pause/resume cycle.
 */
export function useVAD(enabled: boolean, stream: MediaStream | null): UseVADReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !stream) {
      // Destroy VAD when disabled or the shared stream isn't ready yet
      if (vadRef.current) {
        vadRef.current.destroy?.();
        vadRef.current = null;
      }
      setIsSpeaking(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const activeStream = stream;

    async function initVAD() {
      setIsLoading(true);
      setError(null);
      try {
        const { MicVAD } = await import('@ricky0123/vad-web');
        if (cancelled) return;

        const micVAD = await MicVAD.new({
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',
          model: 'v5',
          // Reuse the caller's already-granted stream instead of letting
          // MicVAD open its own — track lifecycle stays owned by
          // useAudioRecorder, so pause/resume here are no-ops.
          getStream: async () => activeStream,
          pauseStream: async () => {},
          resumeStream: async () => activeStream,
          onSpeechStart: () => {
            if (enabledRef.current) setIsSpeaking(true);
          },
          onSpeechEnd: () => {
            setIsSpeaking(false);
          },
        });

        if (cancelled) {
          micVAD.destroy();
          return;
        }

        vadRef.current = micVAD;
        micVAD.start();
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('VAD initialization failed:', err);
        setError(err instanceof Error ? err.message : 'VAD failed to load');
        setIsLoading(false);
      }
    }

    initVAD();

    return () => {
      cancelled = true;
      if (vadRef.current) {
        vadRef.current.destroy?.();
        vadRef.current = null;
      }
      setIsSpeaking(false);
    };
  }, [enabled, stream]);

  const start = useCallback(() => {
    vadRef.current?.start();
  }, []);

  const pause = useCallback(() => {
    vadRef.current?.pause();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, isLoading, error, start, pause };
}
