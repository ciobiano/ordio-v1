import { useRef, useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';

interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob) => Promise<void>;
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
    setIsEnhancing,
    setEnhanceProgress,
  } = useStore();

  const [processingProgress, setProcessingProgress] = useState(0);

  // Ref pattern: keeps processAudio identity stable across renders.
  const transcriptionRef = useRef(transcription);
  transcriptionRef.current = transcription;

  const processAudio = useCallback(
    async (inputBlob: Blob) => {
      let blob = inputBlob;
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const { enhanceTier } = useStore.getState();
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        const audioCtx = new AudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        void audioCtx.close(); // free immediately — no longer needed after decode
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setProcessingProgress(decodeEnd);

        // Step 2: Enhance audio if tier selected (15–40%)
        if (enhanceTier !== 'none') {
          setIsEnhancing(true);
          setProcessingProgress(15);
          const result = await enhanceAudio(blob, enhanceTier, (p) => {
            setEnhanceProgress(p);
            setProcessingProgress(15 + (p / 100) * 25);
          });
          if (result.ok) {
            // Re-decode the enhanced audio
            const enhancedCtx = new AudioContext();
            const enhancedBuffer = await enhancedCtx.decodeAudioData(
              await result.blob.arrayBuffer()
            );
            void enhancedCtx.close();
            setAudioBuffer(enhancedBuffer);
            setAudioDuration(enhancedBuffer.duration);
            blob = result.blob;
          }
          // If !result.ok, continue with original blob (graceful degradation)
          setIsEnhancing(false);
          setEnhanceProgress(0);
          setProcessingProgress(40);
        }

        // Step 3: Transcribe with Whisper (25–70% without enhance, 40–75% with)
        const baseTranscribe = enhanceTier !== 'none' ? 40 : 25;
        const baseFinalize = enhanceTier !== 'none' ? 75 : 70;
        setProcessingProgress(baseTranscribe + 5);
        const words = await transcriptionRef.current.transcribeAudio(blob);

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        }
        setProcessingProgress(baseFinalize);

        // Step 4: Finalize (70–100% without enhance, 75–100% with)
        setProcessingProgress(baseFinalize + 15);
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
      setIsEnhancing,
      setEnhanceProgress,
    ]
  );

  return { processingProgress, processAudio };
}
