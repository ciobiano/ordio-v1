import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from './frameRenderer';
import { loadFont } from '../loaders';
import { loadGraphic } from '../loaders';
import type { EncodeVideoOptions, EncodeResult } from './videoEncoder';

/** Lines ffmpeg.wasm logs at the end of a run whatever happened; never the reason. */
const NON_REASON_LOG_LINES = new Set(['Aborted()', 'Conversion failed!']);

/**
 * Encode canvas frames + audio into an MP4 file using ffmpeg.wasm.
 * Fallback for browsers without WebCodecs support (no `AudioEncoder`: Safari
 * before 26, older browsers).
 *
 * Progress split: 0–90% = frame rendering, 90–100% = ffmpeg transcode.
 * WASM is loaded lazily on first call — zero bundle impact on the primary path.
 */
export async function encodeVideoFFmpeg(options: EncodeVideoOptions): Promise<EncodeResult> {
  // Lazy-load @ffmpeg/ffmpeg — only bundled if this path is reached
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new FFmpeg();
  try {
    return await encodeWith(ffmpeg, options);
  } finally {
    // Kill the worker whatever happened. It frees the WASM heap holding every
    // frame, and it is the only way to stop a cancelled transcode: the abort
    // rejects exec() but the worker would keep encoding.
    ffmpeg.terminate();
  }
}

async function encodeWith(ffmpeg: FFmpeg, options: EncodeVideoOptions): Promise<EncodeResult> {
  const {
    canvas,
    audioBuffer,
    transcript,
    captionGroups,
    style,
    waveformStyle,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionTransform,
    onProgress,
    signal,
    backgroundImage,
  } = options;

  // A failed run resolves with a non-zero exit code; the log says why.
  let lastLogLine = '';
  ffmpeg.on('log', ({ message }) => {
    if (!NON_REASON_LOG_LINES.has(message)) lastLogLine = message;
  });

  // Load WASM from self-hosted public/ffmpeg/ (same-origin, no CORS needed)
  const baseUrl = `${window.location.origin}/ffmpeg`;
  await ffmpeg.load(
    {
      coreURL: `${baseUrl}/ffmpeg-core.js`,
      wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
    },
    { signal }
  );

  // Load font before rendering
  await loadFont(style.fontFamily);
  await loadFont('Geist');

  if (graphicStyle) await loadGraphic(graphicStyle);

  // Ensure canvas dimensions match style
  canvas.width = style.width;
  canvas.height = style.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context');

  const waveformData = waveformSampler(audioBuffer, 200);
  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);

  const frameOptions: FrameOptions = {
    waveformData,
    transcript,
    captionGroups,
    style,
    waveformStyle,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionTransform,
  };

  // Render frames to JPEG and write to ffmpeg virtual FS
  let lastProgressPct = -1;
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    renderFrame(ctx, i, totalFrames, { ...frameOptions, backgroundFrame: backgroundImage });

    const jpeg = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
    });

    const filename = `frame${String(i).padStart(6, '0')}.jpg`;
    await ffmpeg.writeFile(filename, await blobToUint8Array(jpeg));

    // Deduplicate to at most one call per integer percent of the 0–90% range
    const pct = Math.floor(((i + 1) / totalFrames) * 90);
    if (onProgress && pct !== lastProgressPct) {
      onProgress(((i + 1) / totalFrames) * 0.9);
      lastProgressPct = pct;
    }
  }

  // Write audio as WAV
  await ffmpeg.writeFile('audio.wav', audioBufferToWav(audioBuffer));

  // exec() only hears an abort that happens after it starts.
  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  // Transcode: frames + audio → MP4
  const exitCode = await ffmpeg.exec(
    [
      '-framerate',
      String(FPS),
      '-i',
      'frame%06d.jpg',
      '-i',
      'audio.wav',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-pix_fmt',
      'yuv420p',
      '-shortest',
      'output.mp4',
    ],
    -1,
    { signal }
  );
  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}: ${lastLogLine}`);
  }

  onProgress?.(1.0);

  // No virtual-FS cleanup: terminating the worker frees all of it.
  const data = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });

  return { blob, mimeType: 'video/mp4' };
}

/**
 * Encode an AudioBuffer as a RIFF/WAV Uint8Array (PCM int16, interleaved channels).
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2; // int16
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert float32 → int16
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
