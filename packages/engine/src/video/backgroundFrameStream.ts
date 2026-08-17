/**
 * Streams decoded background-loop frames for export compositing.
 *
 * One VideoSample is alive at a time: the encode loop pulls the sample for
 * each output frame, draws it, and this module closes it before decoding
 * the next — never pre-extracting the loop's frames (300 raw 720p frames
 * ≈ 1GB, the same memory trap episode ingestion avoids).
 *
 * Looping: output-frame timestamps come from pingPongTime — the loop reflects
 * (0→D→0) rather than restarting (0→D, 0→D), so there is no jump cut at the
 * wrap. The reverse leg seeks backward, which costs the decoder real work, but
 * export is offline: that is wall-clock time rather than dropped frames. The
 * preview cannot make the same trade and bakes the sequence instead
 * (media/bakePingPongLoop), driven by the same function so the two agree.
 */
import { pingPongTimestamps } from './pingPongTime';

export interface BackgroundFrame {
  image: CanvasImageSource & { width?: number; height?: number };
  close: () => void;
}

export interface BackgroundFrameStream {
  /** Pull the frame for the next output timestamp. Null = hold last drawn. */
  next: () => Promise<BackgroundFrame | null>;
  dispose: () => void;
}

/**
 * The loop duration this module maps timestamps against.
 *
 * Callers that need to size a full ping-pong cycle before opening the stream
 * must measure it through here rather than via `input.computeDuration()`. The
 * two can disagree by a frame or two (container vs. track), and a cycle sized
 * from the wrong one runs past the seamless point — which would put the jump
 * cut straight back at the wrap of the baked asset.
 */
export async function probeBackgroundLoopDuration(source: Blob): Promise<number> {
  const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Background video has no video track.');
    return await track.computeDuration();
  } finally {
    input.dispose();
  }
}

export async function createBackgroundFrameStream(
  source: Blob,
  totalFrames: number,
  fps: number
): Promise<BackgroundFrameStream> {
  const { Input, BlobSource, ALL_FORMATS, VideoSampleSink } = await import('mediabunny');

  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) {
    input.dispose();
    throw new Error('Cannot decode background video in this browser.');
  }

  const loopDuration = await track.computeDuration();
  const sink = new VideoSampleSink(track);
  const timestamps = pingPongTimestamps(totalFrames, fps, loopDuration);
  const generator = sink.samplesAtTimestamps(timestamps);

  return {
    next: async () => {
      const { value: sample, done } = await generator.next();
      if (done || !sample) return null;
      const image = sample.toCanvasImageSource();
      return {
        image,
        close: () => {
          if (typeof VideoFrame !== 'undefined' && image instanceof VideoFrame) image.close();
          sample.close();
        },
      };
    },
    dispose: () => {
      void generator.return(undefined);
      input.dispose();
    },
  };
}
