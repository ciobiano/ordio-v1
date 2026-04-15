// apps/web/src/hooks/useAudioProcessing.ts
import { useRef, useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { useUIStore, useCaptureStore, useProcessingStore } from '@/stores';
import { enhanceAudio } from '@/lib/audioEnhanceApi';
import { decodeBlobToAudioBuffer } from '@/lib/media';
import type { UseTranscriptionReturn } from '@/hooks/recording/useTranscription';
import { toast } from 'sonner';

const WHISPER_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB - under Vercel 4.5MB limit
interface UseAudioProcessingReturn {
  processingProgress: number;
  processAudio: (blob: Blob) => Promise<string>;
  cancelProcessing: () => void;
}
const WHISPER_SUPPORTED_MIME_TYPES = new Set([
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
  'video/mp4',
  'video/webm',
]);

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
}

function shouldTranscodeForWhisper(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return false;
  return !WHISPER_SUPPORTED_MIME_TYPES.has(normalized);
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

    await ffmpeg.exec(['-i', 'input.wav', '-acodec', 'libmp3lame', '-b:a', '96k', 'output.mp3']);

    if (abort.aborted) {
      await ffmpeg.deleteFile('input.wav');
      await ffmpeg.deleteFile('output.mp3');
      throw new DOMException('Aborted', 'AbortError');
    }

    const outputData = (await ffmpeg.readFile('output.mp3')) as Uint8Array;
    await ffmpeg.deleteFile('input.wav');
    await ffmpeg.deleteFile('output.mp3');

    return new Blob([outputData.buffer as ArrayBuffer], { type: 'audio/mp3' });
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
          const result = await enhanceAudio(blob, enhanceTier, (p) => {
            setEnhanceProgress(p);
            setProcessingProgress(15 + (p / 100) * 25);
          });
          if (result.ok) {
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
          }
          setIsEnhancing(false);
          setEnhanceProgress(0);
          setProcessingProgress(40);
        }

        // Step 3: Transcribe + upload in parallel (25–85%)
        const baseTranscribe = enhanceTier !== 'none' ? 40 : 25;
        setProcessingProgress(baseTranscribe + 5);

        // If too large, FFmpeg compress to MP3 first (don't convert to WAV)
        const needsCompression =
          shouldTranscodeForWhisper(rawBlob.type) || rawBlob.size > WHISPER_SIZE_LIMIT;
        let transcriptionBlob: Blob;
        if (needsCompression) {
          transcriptionBlob = await reduceAudioForWhisper(transcriptionBuffer, abort.signal);
        } else if (shouldTranscodeForWhisper(rawBlob.type)) {
          transcriptionBlob = audioBufferToWavBlob(transcriptionBuffer);
        } else {
          transcriptionBlob = rawBlob;
        }

        const [words, storageId] = await Promise.all([
          // 3a: Whisper transcription
          transcriptionRef.current.transcribeAudio(transcriptionBlob),

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
            const { storageId } = (await uploadRes.json()) as { storageId: string };
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
        } else if (transcription.error) {
          toast.error(transcription.error);
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
