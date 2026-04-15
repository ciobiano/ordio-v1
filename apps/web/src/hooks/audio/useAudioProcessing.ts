// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useUIStore, useCaptureStore, useProcessingStore } from '@/stores';
import type { AppPhase } from '@/stores';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import { decodeBlobToAudioBuffer } from '@/lib/media';
import type { UseTranscriptionReturn } from '@/hooks/recording/useTranscription';

const WHISPER_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB - under Vercel 4.5MB limit
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
const WHISPER_SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/ogg',
  'audio/oga',
  'audio/wav',
  'audio/webm',
  'audio/x-flac',
  'audio/x-m4a',
  'audio/x-wav',
]);

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
}

function shouldTranscodeForWhisper(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return true;
  if (normalized.startsWith('video/')) return true;
  return !WHISPER_SUPPORTED_AUDIO_MIME_TYPES.has(normalized);
}

function pickWhisperWavSampleRate(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 16_000;
  const maxMonoSampleRate = Math.floor((WHISPER_SIZE_LIMIT - 44) / (durationSec * 2));
  if (maxMonoSampleRate >= 16_000) return 16_000;
  if (maxMonoSampleRate >= 12_000) return 12_000;
  if (maxMonoSampleRate >= 8_000) return 8_000;
  return 8_000;
}

async function normalizeAudioForWhisper(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  if (typeof window === 'undefined' || typeof window.OfflineAudioContext === 'undefined') {
    return audioBuffer;
  }

  const targetSampleRate = pickWhisperWavSampleRate(audioBuffer.duration);
  const alreadyOptimized =
    audioBuffer.numberOfChannels === 1 && audioBuffer.sampleRate === targetSampleRate;
  if (alreadyOptimized) return audioBuffer;

  const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
  const offlineCtx = new window.OfflineAudioContext(1, frameCount, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering();
}

function targetMp3BitrateKbps(durationSec: number): number {
  const safePayloadBits = Math.max(0, (WHISPER_SIZE_LIMIT - 32 * 1024) * 8); // keep headroom for multipart
  const seconds = Math.max(durationSec, 1);
  const calculatedKbps = Math.floor(safePayloadBits / seconds / 1000);
  return Math.max(24, Math.min(96, calculatedKbps));
}

function audioBufferToWavBytes(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2; // int16 PCM
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}

function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  return new Blob([audioBufferToWavBytes(audioBuffer)], { type: 'audio/wav' });
}

async function reduceAudioForWhisper(audioBuffer: AudioBuffer, abort: AbortSignal): Promise<Blob> {
  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg();

    const baseUrl = `${window.location.origin}/ffmpeg`;
    await ffmpeg.load({
      coreURL: `${baseUrl}/ffmpeg-core.js`,
      wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
    });

    const wavBytes = audioBufferToWavBytes(audioBuffer);
    const wavUint8 = new Uint8Array(wavBytes);
    await ffmpeg.writeFile('input.wav', wavUint8);

    const bitrateKbps = targetMp3BitrateKbps(audioBuffer.duration);
    await ffmpeg.exec([
      '-i',
      'input.wav',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-acodec',
      'libmp3lame',
      '-b:a',
      `${bitrateKbps}k`,
      'output.mp3',
    ]);

    if (abort.aborted) {
      await ffmpeg.deleteFile('input.wav');
      await ffmpeg.deleteFile('output.mp3');
      throw new DOMException('Aborted', 'AbortError');
    }

    const outputData = (await ffmpeg.readFile('output.mp3')) as Uint8Array;
    await ffmpeg.deleteFile('input.wav');
    await ffmpeg.deleteFile('output.mp3');

    const compressed = new Blob([outputData.buffer as ArrayBuffer], { type: 'audio/mp3' });
    if (compressed.size > WHISPER_SIZE_LIMIT) {
      throw new Error('Compressed audio still exceeds production upload limit');
    }
    return compressed;
  } catch (err) {
    console.error('reduceAudioForWhisper failed:', err);
    throw err;
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
        const enhanceTier = useProcessingStore.getState().enhanceTier;
        const decodeEnd = enhanceTier !== 'none' ? 15 : 25;
        setProcessingProgress(10);
        let decoded: AudioBuffer;
        let transcriptionBuffer: AudioBuffer;
        try {
          const { audioBuffer, decodePath } = await decodeBlobToAudioBuffer(blob);
          decoded = audioBuffer;
          transcriptionBuffer = audioBuffer;
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
          mimeType: blob.type || 'audio/webm',
          durationSec: decoded.duration,
          transcript: words,
        });

        // Step 5: Finalize
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
