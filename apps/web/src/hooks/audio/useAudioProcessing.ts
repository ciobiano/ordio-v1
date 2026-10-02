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
import type { Word } from '@Ordio/shared/schemas';
import { expectedTranscribeMs, transcribeProgressAt } from '@/lib/audio/transcribeProgress';
import { OrdioError, isAbortError, toOrdioError } from '@/lib/errors/OrdioError';
import { decodeCodeFor, uploadCodeFor } from '@/lib/errors/classify';
import type { ErrorCode } from '@/lib/errors/catalog';
import { notifyError } from '@/lib/errors/notify';

interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob) => Promise<string>;
  cancelProcessing: () => void;
}

export type AudioProcessingFailureStage = 'enhancement' | 'transcription' | 'processing';

/**
 * A pipeline failure: which step it happened in, and its name.
 *
 * `stage` decides what the person is offered (only an enhancement failure
 * offers turning enhancement off); `code` decides what they are told. The
 * original failure stays on `cause` — the out-of-credits check reads it.
 */
export class AudioProcessingError extends OrdioError {
  readonly stage: AudioProcessingFailureStage;

  constructor(stage: AudioProcessingFailureStage, code: ErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'AudioProcessingError';
    this.stage = stage;
  }
}

/**
 * Run one pipeline step, naming whatever it throws. A named failure keeps its
 * own code; anything else takes the step's. Cancellation passes through
 * untouched, because it is not a failure.
 */
async function step<T>(
  stage: AudioProcessingFailureStage,
  code: ErrorCode,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isAbortError(err) || err instanceof AudioProcessingError) throw err;
    throw new AudioProcessingError(stage, toOrdioError(err, code).code, err);
  }
}

function isSilentTranscript(words: Word[]): boolean {
  return words.every((w) => w.text.trim().length === 0);
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
        // Step 1: Decode audio (0–15% when enhancing, 0–25% otherwise)
        const enhanceTier = useProcessingStore.getState().enhanceTier;
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        const { audioBuffer: decoded } = await decodeBlobToAudioBuffer(blob).catch((err: unknown) => {
          throw new AudioProcessingError('processing', decodeCodeFor(err), err);
        });
        let transcriptionBuffer: AudioBuffer = decoded;
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
              throw new AudioProcessingError('enhancement', result.code, new Error(result.error));
            }
            const enhancedCtx = new AudioContext();
            let enhancedBuffer: AudioBuffer;
            try {
              enhancedBuffer = await enhancedCtx.decodeAudioData(await result.blob.arrayBuffer());
              void enhancedCtx.close();
            } catch (decodeErr) {
              void enhancedCtx.close();
              throw new AudioProcessingError('enhancement', 'ENHANCE_OUTPUT_UNREADABLE', decodeErr);
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
          } catch (reduceErr) {
            // A cancel during compression is a cancel, not a reason to fall back.
            if (isAbortError(reduceErr)) throw reduceErr;
            // FFmpeg can fail in some production environments; retry with whisper-normalized WAV.
            const fallbackWav = audioBufferToWavBlob(await getWhisperReadyBuffer());
            if (fallbackWav.size <= WHISPER_SIZE_LIMIT) {
              transcriptionBlob = fallbackWav;
            } else {
              throw new AudioProcessingError('transcription', 'AUDIO_TOO_LARGE_TO_TRANSCRIBE', reduceErr);
            }
          }
        }

        // Decoded duration sizes the credit hold; the server settles against
        // Whisper's own figure afterwards.
        const transcriptionTask = step('transcription', 'TRANSCRIBE_FAILED', () =>
          transcriptionRef.current.transcribeAudio(transcriptionBlob, decoded.duration)
        );

        const uploadTask = (async () => {
          const uploadUrl = await step('processing', 'UPLOAD_URL_FAILED', () =>
            generateUploadUrlRef.current()
          );
          const uploadRes = await step('processing', 'UPLOAD_FAILED', () =>
            fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': blob.type },
              body: blob,
              signal: abort.signal,
            })
          );
          if (!uploadRes.ok) {
            throw new AudioProcessingError(
              'processing',
              uploadCodeFor(uploadRes.status),
              new Error(`Storage upload returned HTTP ${uploadRes.status}`)
            );
          }
          const { storageId } = await step('processing', 'UPLOAD_FAILED', () =>
            uploadRes.json() as Promise<{ storageId: string }>
          );
          return storageId as GenericId<'_storage'>;
        })();

        /* Whisper reports nothing until it returns, so this step is projected
           from the audio length rather than left as a 40-point hold. The
           ceiling is one short of the step's end: only the response itself
           may draw the step as finished. */
        const transcribeStart = Date.now();
        const expectedMs = expectedTranscribeMs(decoded.duration);
        const creep = window.setInterval(() => {
          setProcessingProgress(
            transcribeProgressAt(Date.now() - transcribeStart, expectedMs, baseTranscribe + 5, 84)
          );
        }, 250);

        let words: Word[];
        let storageId: GenericId<'_storage'>;
        try {
          [words, storageId] = await Promise.all([transcriptionTask, uploadTask]);
        } finally {
          window.clearInterval(creep);
        }

        if (words.length > 0) {
          setTranscript(words);
          setTranscriptionSource('whisper');
        }
        /* Not a failure — a silent take still makes a waveform video — but
           a video with no captions should never be a surprise. */
        if (isSilentTranscript(words)) notifyError(new OrdioError('TRANSCRIBE_NO_SPEECH'));
        setProcessingProgress(85);

        // Step 4: Create session document → get sessionId
        setProcessingProgress(90);
        const sessionId = await step('processing', 'SESSION_SAVE_FAILED', () =>
          createSessionRef.current({
            storageId,
            mimeType: blob.type || 'audio/webm',
            durationSec: decoded.duration,
            transcript: words,
          })
        );

        // Step 5: Finalize
        void clearRecordingDraft();
        setProcessingProgress(100);

        return sessionId;
      } catch (err) {
        setCurrentState(stateBeforeProcessing);
        if (isAbortError(err)) return '';
        if (err instanceof AudioProcessingError) {
          console.error(`[useAudioProcessing] ${err.code}`, err.cause ?? err);
          throw err;
        }
        console.error('[useAudioProcessing] PROCESSING_FAILED', err);
        throw new AudioProcessingError('processing', toOrdioError(err, 'PROCESSING_FAILED').code, err);
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
