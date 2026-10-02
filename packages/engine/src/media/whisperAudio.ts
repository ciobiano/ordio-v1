const WHISPER_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB - under Vercel 4.5MB limit

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

function pickWhisperWavSampleRate(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 16_000;
  const maxMonoSampleRate = Math.floor((WHISPER_SIZE_LIMIT - 44) / (durationSec * 2));
  if (maxMonoSampleRate >= 16_000) return 16_000;
  if (maxMonoSampleRate >= 12_000) return 12_000;
  if (maxMonoSampleRate >= 8_000) return 8_000;
  return 8_000;
}

export async function normalizeAudioForWhisper(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
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
  const safePayloadBits = Math.max(0, (WHISPER_SIZE_LIMIT - 32 * 1024) * 8); // keep multipart headroom
  const seconds = Math.max(durationSec, 1);
  const calculatedKbps = Math.floor(safePayloadBits / seconds / 1000);
  return Math.max(24, Math.min(96, calculatedKbps));
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

export async function reduceAudioForWhisper(audioBuffer: AudioBuffer, abort: AbortSignal): Promise<Blob> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new FFmpeg();

  const baseUrl = `${window.location.origin}/ffmpeg`;
  await ffmpeg.load({
    coreURL: `${baseUrl}/ffmpeg-core.js`,
    wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
  });

  const wavBytes = audioBufferToWavBytes(audioBuffer);
  await ffmpeg.writeFile('input.wav', new Uint8Array(wavBytes));

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
    throw new WhisperSizeLimitError();
  }
  return compressed;
}

/** Audio that is still over Whisper's upload limit after compression. */
export class WhisperSizeLimitError extends Error {
  constructor() {
    super('Compressed audio still exceeds production upload limit');
    this.name = 'WhisperSizeLimitError';
  }
}

export { WHISPER_SIZE_LIMIT };

