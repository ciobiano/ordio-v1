import { useRef, useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';

interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob, liveTranscriptFallback?: boolean) => Promise<void>;
}

/**
 * Handles the decode → transcribe → finalize pipeline for both
 * recorded audio and uploaded files. Shared by both code paths.
 */
export function useAudioProcessing(
  transcription: UseTranscriptionReturn
): UseAudioProcessingReturn {
  const {
    setCurrentState,
    setAudioBuffer,
    setAudioBlob,
    setAudioDuration,
    setTranscript,
    setTranscriptionSource,
  } = useStore();

  const [processingProgress, setProcessingProgress] = useState(0);

  // Ref pattern: keeps processAudio identity stable even as transcription
  // state (liveWords, isTranscribing, etc.) changes on every speech event.
  const transcriptionRef = useRef(transcription);
  transcriptionRef.current = transcription;

  const processAudio = useCallback(
    async (blob: Blob, liveTranscriptFallback = false) => {
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        // Step 1: Decode audio (0–25%)
        setProcessingProgress(10);
        const audioCtx = new AudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        void audioCtx.close(); // free immediately — no longer needed after decode
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setProcessingProgress(25);

        // Step 2: Transcribe with Whisper (25–70%)
        if (liveTranscriptFallback) {
          transcriptionRef.current.stopLiveTranscription();
        }
        setProcessingProgress(30);
        const words = await transcriptionRef.current.transcribeAudio(blob);

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        } else if (liveTranscriptFallback) {
          setTranscript(transcriptionRef.current.transcript);
          setTranscriptionSource('webspeech');
        }
        setProcessingProgress(70);

        // Step 3: Finalize (70–100%)
        setProcessingProgress(90);
        await new Promise((r) => setTimeout(r, 250));
        setProcessingProgress(100);
        setTimeout(() => setCurrentState('export'), 300);
      } catch {
        setCurrentState('idle');
        throw new Error('Audio processing failed');
      }
    },
    // transcription is intentionally omitted — accessed via transcriptionRef
    // so processAudio identity stays stable across speech events.
    [
      setCurrentState,
      setAudioBuffer,
      setAudioBlob,
      setAudioDuration,
      setTranscript,
      setTranscriptionSource,
    ]
  );

  return { processingProgress, processAudio };
}
