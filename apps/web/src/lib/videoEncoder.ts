import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
} from 'mediabunny';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from '@/lib/frameRenderer';
import { loadFont } from '@/lib/fontLoader';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { WaveformVariant, CaptionVariant } from '@/lib/store';

export interface EncodeVideoOptions {
  /** Canvas element to render frames onto */
  canvas: HTMLCanvasElement;
  /** Decoded audio buffer */
  audioBuffer: AudioBuffer;
  /** Word-level transcript */
  transcript: Word[];
  /** Visual style */
  style: StyleConfig;
  /** Waveform variant */
  waveformStyle: WaveformVariant;
  /** Caption variant */
  captionStyle: CaptionVariant;
  /** Show "Made with Ordio" watermark — true for free tier */
  showWatermark?: boolean;
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface EncodeResult {
  blob: Blob;
  mimeType: string;
}

/**
 * Encode canvas frames + audio into an MP4 file using Mediabunny + WebCodecs.
 *
 * Flow:
 * 1. Pre-compute waveform data from audioBuffer
 * 2. Set up Mediabunny Output with MP4 format + BufferTarget
 * 3. Add CanvasSource (video) and AudioBufferSource (audio) tracks
 * 4. Loop frame-by-frame: renderFrame() → canvasSource.add()
 * 5. Finalize and return Blob
 */
export async function encodeVideo(options: EncodeVideoOptions): Promise<EncodeResult> {
  const {
    canvas,
    audioBuffer,
    transcript,
    style,
    waveformStyle,
    captionStyle,
    showWatermark,
    onProgress,
    signal,
  } = options;

  // Load font before rendering
  await loadFont(style.fontFamily);

  // Ensure canvas dimensions match style
  canvas.width = style.width;
  canvas.height = style.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context');

  // Pre-compute waveform data
  const waveformData = waveformSampler(audioBuffer, 200);

  const duration = audioBuffer.duration;
  const totalFrames = Math.ceil(duration * FPS);
  const frameDuration = 1 / FPS;

  // Set up Mediabunny output
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  // Video track
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: 4_000_000, // 4 Mbps for 1080p
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });

  // Audio track
  const audioSource = new AudioBufferSource({
    codec: 'aac',
    bitrate: 128_000, // 128 kbps
  });
  output.addAudioTrack(audioSource);

  await output.start();

  // Feed audio buffer
  await audioSource.add(audioBuffer);
  audioSource.close();

  // Frame options (shared across all frames)
  const frameOptions: FrameOptions = {
    waveformData,
    transcript,
    style,
    waveformStyle,
    captionStyle,
    showWatermark,
  };

  // Render and encode frame by frame
  let lastProgressPct = -1;
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // Render frame to canvas
    renderFrame(ctx, i, totalFrames, frameOptions);

    // Encode current canvas state
    const timestamp = i * frameDuration;
    await videoSource.add(timestamp, frameDuration);

    // Report progress — deduplicated to at most one call per integer percent
    if (onProgress) {
      const pct = Math.floor(((i + 1) / totalFrames) * 100);
      if (pct !== lastProgressPct) {
        onProgress((i + 1) / totalFrames);
        lastProgressPct = pct;
      }
    }
  }

  // Close video source and finalize
  videoSource.close();
  await output.finalize();

  // Extract the encoded file
  const buffer = target.buffer;
  if (!buffer) throw new Error('Encoding produced no output');
  const blob = new Blob([buffer], { type: 'video/mp4' });

  return { blob, mimeType: 'video/mp4' };
}

/**
 * Check if the browser supports WebCodecs (required for Mediabunny encoding).
 */
export function hasWebCodecsSupport(): boolean {
  return (
    typeof globalThis.VideoEncoder !== 'undefined' &&
    typeof globalThis.AudioEncoder !== 'undefined'
  );
}
