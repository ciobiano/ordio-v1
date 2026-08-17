/**
 * Streams decoded background-loop frames for export compositing.
 *
 * One VideoSample is alive at a time: the encode loop pulls the sample for
 * each output frame, draws it, and this module closes it before decoding
 * the next — never pre-extracting the loop's frames (300 raw 720p frames
 * ≈ 1GB, the same memory trap episode ingestion avoids).
 *
 * Looping: output-frame timestamps are mapped modulo the background's duration.
 * The wrap forces one decoder re-seek per loop (~every 10s of output), which is
 * cheap, and the sequence stays monotonically increasing — which matters more
 * than it looks. `samplesAtTimestamps` documents an optimized path taken *only*
 * for monotonically sorted timestamps, decoding each packet at most once.
 *
 * A reflecting ("ping-pong") sequence was tried here to remove the visible cut
 * at the wrap. It reversed direction, left that fast path, and re-decoded from
 * the previous keyframe on every descending step. Any future attempt has to
 * decode forward in bounded windows and emit each window backwards, so the
 * monotonic guarantee holds inside the decoder even though output runs backwards.
 */

/** Map output timestamps onto a looping background. Pure — unit-testable. */
export function loopTimestamps(
  totalFrames: number,
  fps: number,
  loopDurationSec: number
): number[] {
  if (totalFrames <= 0 || fps <= 0 || loopDurationSec <= 0) return [];
  const out = new Array<number>(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    out[i] = (i / fps) % loopDurationSec;
  }
  return out;
}

export interface BackgroundFrame {
  image: CanvasImageSource & { width?: number; height?: number };
  close: () => void;
}

export interface BackgroundFrameStream {
  /** Pull the frame for the next output timestamp. Null = hold last drawn. */
  next: () => Promise<BackgroundFrame | null>;
  dispose: () => void;
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
  const timestamps = loopTimestamps(totalFrames, fps, loopDuration);
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
