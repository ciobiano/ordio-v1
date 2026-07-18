// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useUIStore, useCaptureStore, useProcessingStore } from '@/stores';
import type { AppPhase } from '@/stores';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import { decodeBlobToAudioBuffer } from '@Ordio/engine/media';
import { clearRecordingDraft } from '@/lib/persistence/recordingDraft';
import type { UseTranscriptionReturn } from '@/hooks/recording/useTranscription';
import {
  audioBufferToWavBlob,
  normalizeAudioForWhisper,
  reduceAudioForWhisper,
  shouldTranscodeForWhisper,
  WHISPER_SIZE_LIMIT,
} from '@Ordio/engine/media/whisperAudio';
import { sendProcessingDebugIngest } from './processing/debugIngest';
interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob) => Promise<string>;
  cancelProcessing: () => void;
}

export type AudioProcessingFailureStage = 'enhancement' | 'transcription' | 'processing';

export class AudioProcessingError extends Error {
  stage: AudioProcessingFailureStage;

  constructor(stage: AudioProcessingFailureStage, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'AudioProcessingError';
    this.stage = stage;
  }
}

/**
 * Handles the decode → transcribe → upload → finalize pipeline.
 * Returns a Convex session ID that the caller uses to navigate to
 * /create/export/[sessionId].
 */
export function useAudioProcessing(
  transcription: UseTranscriptionReturn
): UseAudioProcessingReturn {
  const currentState = useUIStore((s) => s.currentState);
  const setCurrentState = useUIStore((s) => s.setCurrentState);
  const { setAudioBuffer, setAudioBlob, setAudioDuration } = useCaptureStore();
  const { setTranscript, setTranscriptionSource, setIsEnhancing, setEnhanceProgress } =
    useProcessingStore();

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
      const stateBeforeProcessing: AppPhase = currentState === 'processing' ? 'idle' : currentState;
      let blob = inputBlob;
      const rawBlob = inputBlob;
      const abort = new AbortController();
      abortControllerRef.current = abort;
      setCurrentState('processing');
      setProcessingProgress(0);

      try {
        sendProcessingDebugIngest({
          location: 'useAudioProcessing.ts:processAudio:entry',
          message: 'processAudio entry',
          data: {
            mime: blob.type,
            size: blob.size,
            name: blob instanceof File ? blob.name : '(blob)',
          },
          hypothesisId: 'A,B',
        });
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const enhanceTier = useProcessingStore.getState().enhanceTier;
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        let decoded: AudioBuffer;
        let transcriptionBuffer: AudioBuffer;
        try {
          const { audioBuffer, decodePath } = await decodeBlobToAudioBuffer(blob);
          decoded = audioBuffer;
          transcriptionBuffer = audioBuffer;
          sendProcessingDebugIngest({
            location: 'useAudioProcessing.ts:processAudio:decodeOk',
            message: 'decode to AudioBuffer succeeded',
            data: {
              decodePath,
              durationSec: decoded.duration,
              sampleRate: decoded.sampleRate,
            },
            hypothesisId: 'A',
          });
        } catch (decodeErr) {
          sendProcessingDebugIngest({
            location: 'useAudioProcessing.ts:processAudio:decodeFail',
            message: 'decode to AudioBuffer failed',
            data: {
              errName: decodeErr instanceof Error ? decodeErr.name : 'unknown',
              errMessage: decodeErr instanceof Error ? decodeErr.message : String(decodeErr),
            },
            hypothesisId: 'A',
          });
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
          try {
            const result = await enhanceAudio(blob, enhanceTier, (p) => {
              setEnhanceProgress(p);
              setProcessingProgress(15 + (p / 100) * 25);
            });
            if (!result.ok) {
              throw new AudioProcessingError(
                'enhancement',
                'Audio enhancement failed. Processing stopped before transcription.',
                new Error(result.error)
              );
            }
            const enhancedCtx = new AudioContext();
            let enhancedBuffer: AudioBuffer;
            try {
              enhancedBuffer = await enhancedCtx.decodeAudioData(await result.blob.arrayBuffer());
              void enhancedCtx.close();
            } catch (decodeErr) {
              void enhancedCtx.close();
              throw decodeErr;
            }
            setAudioBuffer(enhancedBuffer);
            setAudioDuration(enhancedBuffer.duration);
            blob = result.blob;
            transcriptionBuffer = enhancedBuffer;
          } finally {
            setIsEnhancing(false);
            setEnhanceProgress(0);
          }
          setProcessingProgress(40);
        }

        // Step 3: Transcribe + upload in parallel (25–85%)
        const baseTranscribe = enhanceTier !== 'none' ? 40 : 25;
        setProcessingProgress(baseTranscribe + 5);

        const shouldTranscode = shouldTranscodeForWhisper(rawBlob.type);
        let whisperReadyBuffer: AudioBuffer | null = null;
        const getWhisperReadyBuffer = async (): Promise<AudioBuffer> => {
          if (!whisperReadyBuffer) {
            whisperReadyBuffer = await normalizeAudioForWhisper(transcriptionBuffer);
          }
          return whisperReadyBuffer;
        };
        let transcriptionBlob: Blob;
        if (shouldTranscode) {
          transcriptionBlob = audioBufferToWavBlob(await getWhisperReadyBuffer());
        } else {
          transcriptionBlob = rawBlob;
        }
        if (transcriptionBlob.size > WHISPER_SIZE_LIMIT) {
          try {
            transcriptionBlob = await reduceAudioForWhisper(transcriptionBuffer, abort.signal);
          } catch {
            // FFmpeg can fail in some production environments; retry with whisper-normalized WAV.
            const fallbackWav = audioBufferToWavBlob(await getWhisperReadyBuffer());
            if (fallbackWav.size <= WHISPER_SIZE_LIMIT) {
              transcriptionBlob = fallbackWav;
            } else {
              throw new Error('Audio file is too large to transcribe in production');
            }
          }
        }

        const transcriptionTask = transcriptionRef.current
          .transcribeAudio(transcriptionBlob)
          .catch((err) => {
            throw new AudioProcessingError(
              'transcription',
              err instanceof Error ? err.message : 'Transcription failed',
              err
            );
          });

        const uploadTask = (async () => {
          const uploadUrl = await generateUploadUrlRef.current();
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
            signal: abort.signal,
          });
          if (!uploadRes.ok) throw new Error('Audio upload failed');
          const { storageId } = (await uploadRes.json()) as { storageId: string };
          return storageId as GenericId<'_storage'>;
        })();

        const [words, storageId] = await Promise.all([transcriptionTask, uploadTask]);
        sendProcessingDebugIngest({
          location: 'useAudioProcessing.ts:processAudio:afterTranscribe',
          message: 'transcribe + upload parallel done',
          data: { wordCount: words.length },
          hypothesisId: 'C',
        });

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        }
        setProcessingProgress(85);

        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await createSessionRef.current({
          storageId,
          mimeType: blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript: words,
        });

        // Step 5: Finalize
        void clearRecordingDraft();
        setProcessingProgress(100);

        return sessionId;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setCurrentState(stateBeforeProcessing);
          return '';
        }
        setCurrentState(stateBeforeProcessing);
        console.error('[useAudioProcessing]', err);
        if (err instanceof AudioProcessingError) {
          throw err;
        }
        throw new AudioProcessingError('processing', 'Audio processing failed', err);
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
      currentState,
    ]
  );

  return { processingProgress, processAudio, cancelProcessing };
}
