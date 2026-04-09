// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useStore } from '@/lib/store';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import { decodeBlobToAudioBuffer } from '@/lib/decodeMediaToAudioBuffer';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';
interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob) => Promise<string>;
  cancelProcessing: () => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

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
    async (inputBlob: Blob): Promise<string> => {
      let blob = inputBlob;
      const rawBlob = inputBlob;
      const abort = new AbortController();
      abortControllerRef.current = abort;
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        // #region agent log
        fetch('http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '381f43' },
          body: JSON.stringify({
            sessionId: '381f43',
            runId: 'post-fix',
            location: 'useAudioProcessing.ts:processAudio:entry',
            message: 'processAudio entry',
            data: {
              mime: blob.type,
              size: blob.size,
              name: blob instanceof File ? blob.name : '(blob)',
            },
            timestamp: Date.now(),
            hypothesisId: 'A,B',
          }),
        }).catch(() => {});
        // #endregion
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const { enhanceTier } = useStore.getState();
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        let decoded: AudioBuffer;
        try {
          const { audioBuffer, decodePath } = await decodeBlobToAudioBuffer(blob);
          decoded = audioBuffer;
          // #region agent log
          fetch('http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '381f43' },
            body: JSON.stringify({
              sessionId: '381f43',
              runId: 'post-fix',
              location: 'useAudioProcessing.ts:processAudio:decodeOk',
              message: 'decode to AudioBuffer succeeded',
              data: {
                decodePath,
                durationSec: decoded.duration,
                sampleRate: decoded.sampleRate,
              },
              timestamp: Date.now(),
              hypothesisId: 'A',
            }),
          }).catch(() => {});
          // #endregion
        } catch (decodeErr) {
          // #region agent log
          fetch('http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '381f43' },
            body: JSON.stringify({
              sessionId: '381f43',
              runId: 'post-fix',
              location: 'useAudioProcessing.ts:processAudio:decodeFail',
              message: 'decode to AudioBuffer failed',
              data: {
                errName: decodeErr instanceof Error ? decodeErr.name : 'unknown',
                errMessage: decodeErr instanceof Error ? decodeErr.message : String(decodeErr),
              },
              timestamp: Date.now(),
              hypothesisId: 'A',
            }),
          }).catch(() => {});
          // #endregion
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
              signal: abort.signal,
            });
            if (!uploadRes.ok) throw new Error('Audio upload failed');
            const { storageId } = await uploadRes.json() as { storageId: string };
            return storageId as GenericId<'_storage'>;
          })(),
        ]);
        // #region agent log
        fetch('http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '381f43' },
          body: JSON.stringify({
            sessionId: '381f43',
            runId: 'post-fix',
            location: 'useAudioProcessing.ts:processAudio:afterTranscribe',
            message: 'transcribe + upload parallel done',
            data: { wordCount: words.length },
            timestamp: Date.now(),
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion

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
        });

        // Step 5: Finalize
        setProcessingProgress(100);

        return sessionId;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled — stay idle, no error toast
          setCurrentState('idle');
          return '';
        }
        setCurrentState('idle');
        console.error('[useAudioProcessing]', err);
        throw new Error('Audio processing failed', { cause: err });
      } finally {
        abortControllerRef.current = null;
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

  return { processingProgress, processAudio, cancelProcessing };
}
