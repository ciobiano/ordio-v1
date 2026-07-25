import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource } from 'mediabunny';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS } from '@Ordio/shared/time';
import { renderFrame, type FrameOptions } from './frameRenderer';
import { createBackgroundFrameStream } from './backgroundFrameStream';
import { loadFont, loadGraphic } from '../loaders';
import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { WaveformVariant, CanvasLayout, GraphicStyleId, CaptionTransform, CaptionGroup } from '../types';

export interface EncodeVideoOptions {
  /** Canvas element to render frames onto */
  canvas: HTMLCanvasElement;
  /** Decoded audio buffer */
  audioBuffer: AudioBuffer;
  /** Word-level transcript */
  transcript: Word[];
  /** Editorial caption groups */
  captionGroups?: CaptionGroup[];
  /** Visual style */
  style: StyleConfig;
  /** Waveform variant */
  waveformStyle: WaveformVariant;
  /** Canvas composition layout */
  canvasLayout?: CanvasLayout;
  /** Show "Made with Ordio" watermark — true for free tier */
  showWatermark?: boolean;
  /** Graphic style to render — null or undefined = use waveform */
  graphicStyle?: GraphicStyleId;
  /** Manual caption transform from canvas editor */
  captionTransform?: CaptionTransform;
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /**
   * Looping video background, pre-fetched as a Blob by the caller
   * (curated: fetch from public/backgrounds; custom: fetch from the signed
   * Convex URL). Composited under waveform/captions via the shared
   * renderFrame path, streamed one frame at a time.
   */
  backgroundVideo?: Blob;
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
    captionGroups,
    style,
    waveformStyle,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionTransform,
    onProgress,
    signal,
    backgroundVideo,
  } = options;

  // Load font before rendering
  await loadFont(style.fontFamily);
  await loadFont('Geist');
  if (graphicStyle) await loadGraphic(graphicStyle);

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
    captionGroups,
    style,
    waveformStyle,
    canvasLayout,
    showWatermark,
    graphicStyle,
    captionTransform,
  };

  // Optional looping background stream (one decoded frame alive at a time)
  const backgroundStream = backgroundVideo
    ? await createBackgroundFrameStream(backgroundVideo, totalFrames, FPS)
    : null;

  // Render and encode frame by frame
  let lastProgressPct = -1;
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      const bgFrame = backgroundStream ? await backgroundStream.next() : null;
      try {
        // Render frame to canvas (background composited inside renderFrame
        // so preview == export holds)
        renderFrame(ctx, i, totalFrames, {
          ...frameOptions,
          backgroundFrame: bgFrame?.image,
        });
      } finally {
        bgFrame?.close();
      }

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
  } finally {
    backgroundStream?.dispose();
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
    typeof globalThis.VideoEncoder !== 'undefined' && typeof globalThis.AudioEncoder !== 'undefined'
  );
}
