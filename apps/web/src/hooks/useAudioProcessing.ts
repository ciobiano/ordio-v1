// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useStore } from '@/lib/store';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';
import type { UserTier } from '@/lib/featureGates';

interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob, tier: UserTier) => Promise<string>;
}

/**
 * Handles the decode → transcribe → upload → finalize pipeline.
 * Returns a Convex session ID that the caller uses to navigate to
 * /create/export/[sessionId].
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

  const transcriptionRef = useRef(transcription);
  transcriptionRef.current = transcription;

  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);

  // Stable refs so processAudio closure doesn't change identity when
  // mutation references update between renders.
  const generateUploadUrlRef = useRef(generateUploadUrl);
  generateUploadUrlRef.current = generateUploadUrl;

  const createSessionRef = useRef(createSession);
  createSessionRef.current = createSession;

  const processAudio = useCallback(
    async (inputBlob: Blob, tier: UserTier): Promise<string> => {
      let blob = inputBlob;
      const rawBlob = inputBlob;
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const { enhanceTier } = useStore.getState();
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        const audioCtx = new AudioContext();
        let decoded: AudioBuffer;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          decoded = await audioCtx.decodeAudioData(arrayBuffer);
          void audioCtx.close();
        } catch (decodeErr) {
          void audioCtx.close();
          throw decodeErr;
        }
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
            const enhancedCtx = new AudioContext();
            let enhancedBuffer: AudioBuffer;
            try {
              enhancedBuffer = await enhancedCtx.decodeAudioData(
                await result.blob.arrayBuffer()
              );
              void enhancedCtx.close();
            } catch (decodeErr) {
              void enhancedCtx.close();
              throw decodeErr;
            }
            setAudioBuffer(enhancedBuffer);
            setAudioDuration(enhancedBuffer.duration);
            blob = result.blob;
          }
          setIsEnhancing(false);
          setEnhanceProgress(0);
          setProcessingProgress(40);
        }

        // Step 3: Transcribe + upload in parallel (25–85%)
        const baseTranscribe = enhanceTier !== 'none' ? 40 : 25;
        setProcessingProgress(baseTranscribe + 5);

        const [words, storageId] = await Promise.all([
          // 3a: Whisper transcription
          transcriptionRef.current.transcribeAudio(rawBlob),

          // 3b: Upload audio to Convex storage (two-step)
          (async () => {
            const uploadUrl = await generateUploadUrlRef.current();
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': blob.type },
              body: blob,
            });
            if (!uploadRes.ok) throw new Error('Audio upload failed');
            const { storageId } = await uploadRes.json() as { storageId: string };
            return storageId as GenericId<'_storage'>;
          })(),
        ]);

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        }
        setProcessingProgress(85);

        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await createSessionRef.current({
          storageId,
          mimeType:    blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript:  words,
          tier,
        });

        // Step 5: Finalize
        setProcessingProgress(100);

        return sessionId;
      } catch (err) {
        setCurrentState('idle');
        console.error('[useAudioProcessing]', err);
        throw new Error('Audio processing failed', { cause: err });
      }
    },
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
