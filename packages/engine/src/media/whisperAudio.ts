/**
 * Whisper's own upload limit. Audio reaches Whisper through Convex storage
 * (see apps/web/src/lib/transcription/storedAudio.ts), so this — not Vercel's
 * 4.5MB request limit — is the only size ceiling.
 */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Whisper resamples everything to 16kHz before it listens (Whisper paper,
 * §2.2). So 16kHz mono loses nothing Whisper uses, and anything lower removes
 * speech it would have used: under 8kHz every sound above 4kHz is gone, which
 * is where "s", "f" and "th" live. Audio for transcription is never resampled
 * below this, and never lossy-compressed to fit a size limit.
 */
export const WHISPER_SAMPLE_RATE = 16_000;

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

export function shouldTranscodeForWhisper(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return true;
  if (normalized.startsWith('video/')) return true;
  return !WHISPER_SUPPORTED_AUDIO_MIME_TYPES.has(normalized);
}

/** Size of `durationSec` of 16kHz mono 16-bit WAV, header included. */
export function whisperWavBytes(durationSec: number): number {
  return 44 + Math.ceil(Math.max(0, durationSec) * WHISPER_SAMPLE_RATE) * 2;
}

/** Downmix and resample to 16kHz mono — lossless as far as Whisper can hear. */
export async function normalizeAudioForWhisper(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  if (typeof window === 'undefined' || typeof window.OfflineAudioContext === 'undefined') {
    return audioBuffer;
  }

  const alreadyOptimized =
    audioBuffer.numberOfChannels === 1 && audioBuffer.sampleRate === WHISPER_SAMPLE_RATE;
  if (alreadyOptimized) return audioBuffer;

  const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * WHISPER_SAMPLE_RATE));
  const offlineCtx = new window.OfflineAudioContext(1, frameCount, WHISPER_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering();
}

function audioBufferToWavBytes(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2;
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
  view.setUint16(20, 1, true);
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

export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  return new Blob([audioBufferToWavBytes(audioBuffer)], { type: 'audio/wav' });
}
