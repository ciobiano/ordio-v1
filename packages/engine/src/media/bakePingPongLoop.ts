/**
 * Bake a background loop into a forward+reverse ("ping-pong") asset for preview.
 *
 * Why bake rather than seek: a ping-pong needs the reverse leg to play
 * backward, and video elements cannot (negative playbackRate is not supported),
 * so the only playback-time option is to drive currentTime by hand. That means
 * a backward seek every tick, and a backward seek must decode from the previous
 * keyframe — with a typical 2s GOP at 30fps that is ~30 frames per seek, ~60
 * seeks/sec, several thousand frame-decodes/sec against a decoder that manages
 * a few hundred. The background would visibly stutter. Baking spends a few
 * seconds once so playback is a plain forward `loop=true` at 1x with no seeks
 * at all, which is smooth regardless of how the source was encoded.
 *
 * Why this does not cost storage: it runs at load time on the already-stored
 * 10s asset and never leaves the browser. The baked 20s result is an in-memory
 * blob, so the server's duration and size ceilings stay exactly where they are
 * and the curated assets need no re-encoding.
 *
 * The frame order comes from createBackgroundFrameStream, which takes its
 * timestamps from pingPongTimestamps — the same function the export encoder
 * uses. The baked preview asset and the exported video are therefore the same
 * sequence by construction, not by two implementations agreeing.
 */
import {
  createBackgroundFrameStream,
  probeBackgroundLoopDuration,
} from '../video/backgroundFrameStream';
import { pingPongCycleFrames } from '../video/pingPongTime';
import { sourceDimensions } from '../video/frameRenderer';

/** Matches the background transcode budget — this is the same footage, twice as long. */
export const PING_PONG_BAKE_BITRATE = 1_500_000;

export interface BakedPingPongLoop {
  blob: Blob;
  /** Full cycle length: twice the source, so a native `loop=true` wrap is seamless. */
  durationSec: number;
}

/**
 * Render one complete forward+reverse cycle of `source` to a new MP4.
 *
 * Throws if the source cannot be decoded, so callers can fall back to the
 * un-baked asset rather than showing a broken preview.
 */
export async function bakePingPongLoop(
  source: Blob,
  fps: number,
  onProgress?: (progress: number) => void
): Promise<BakedPingPongLoop> {
  const { Output, BufferTarget, Mp4OutputFormat, CanvasSource } = await import('mediabunny');

  // Measured through the frame stream's own probe so the cycle length and the
  // timestamps it generates cannot disagree. Dimensions come from the first
  // decoded frame instead of container metadata, which may be absent or wrong.
  const sourceDuration = await probeBackgroundLoopDuration(source);
  if (!(sourceDuration > 0)) {
    throw new Error('Background has no playable video.');
  }

  const totalFrames = pingPongCycleFrames(sourceDuration, fps);
  const frameDuration = 1 / fps;
  const stream = await createBackgroundFrameStream(source, totalFrames, fps);

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let output: InstanceType<typeof Output> | null = null;
  let videoSource: InstanceType<typeof CanvasSource> | null = null;
  let target: InstanceType<typeof BufferTarget> | null = null;
  let lastProgressPct = -1;

  try {
    for (let i = 0; i < totalFrames; i++) {
      const frame = await stream.next();
      // Null means the decoder had nothing for this timestamp — hold the last
      // drawn frame, which is also what the apex of the triangle wants.
      if (!frame) {
        if (canvas && videoSource) await videoSource.add(i * frameDuration, frameDuration);
        continue;
      }

      try {
        if (!canvas) {
          const { w, h } = sourceDimensions(frame.image);
          if (!(w > 0) || !(h > 0)) throw new Error('Background frame has no dimensions.');
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get a 2D context to bake the background.');

          target = new BufferTarget();
          output = new Output({ format: new Mp4OutputFormat(), target });
          videoSource = new CanvasSource(canvas, {
            codec: 'avc',
            bitrate: PING_PONG_BAKE_BITRATE,
          });
          output.addVideoTrack(videoSource, { frameRate: fps });
          await output.start();
        }

        ctx!.drawImage(frame.image, 0, 0, canvas.width, canvas.height);
        await videoSource!.add(i * frameDuration, frameDuration);
      } finally {
        frame.close();
      }

      if (onProgress) {
        const pct = Math.floor(((i + 1) / totalFrames) * 100);
        if (pct !== lastProgressPct) {
          onProgress((i + 1) / totalFrames);
          lastProgressPct = pct;
        }
      }
    }
  } catch (err) {
    // A started-but-unfinalized Output holds an encoder and a write handle, so
    // release it before the throw propagates to the caller's fallback path.
    if (output && output.state === 'started') await output.cancel();
    throw err;
  } finally {
    stream.dispose();
  }

  if (!output || !videoSource || !target) {
    throw new Error('Background produced no decodable frames.');
  }

  videoSource.close();
  await output.finalize();

  const buffer = target.buffer;
  if (!buffer) throw new Error('Baking the background loop produced no output.');

  return {
    blob: new Blob([buffer], { type: 'video/mp4' }),
    durationSec: totalFrames * frameDuration,
  };
}
