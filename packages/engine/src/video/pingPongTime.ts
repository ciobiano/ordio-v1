/**
 * Ping-pong (boomerang) loop timing — the single source of truth for how a
 * background loop repeats.
 *
 * A loop played on repeat cuts hard at the wrap: the frame at t=9.97s and the
 * frame at t=0 show unrelated moments, so the viewer sees a jump. Backgrounds
 * are capped at 10s, so under six minutes of audio that cut lands ~36 times.
 * Reflecting the loop instead of restarting it removes the discontinuity
 * outright — the turnaround frame follows itself, so there is no seam left to
 * hide behind a crossfade or a scrim.
 *
 *   sawtooth (before):  0→D, 0→D, 0→D    jumps D at every wrap
 *   triangle (after):   0→D→0→D→0        never jumps more than one frame
 *
 * Both render paths take their timing from here, but realize it differently
 * because their constraints differ. Export is offline, so it can hand this
 * straight to the decoder as a timestamp list and pay for the backward seeks in
 * wall-clock time. Preview is realtime and cannot: a backward seek decodes from
 * the previous keyframe, which at 60 ticks/sec puts the decoder well over
 * budget. So preview bakes this sequence into a forward+reverse asset it plays
 * natively at 1x (see media/bakePingPongLoop).
 *
 * Two mechanisms, one mapping. That is what keeps preview == export true — the
 * agreement is structural rather than two implementations kept in step by hand.
 */

/**
 * Reflect `t` onto a 0→D→0 triangle of period 2D.
 *
 * The apex at phase == D is returned exactly once per cycle, so the source
 * timestamp sequence holds that frame for a single output frame and then walks
 * back down. Pure — unit-testable.
 */
export function pingPongTime(t: number, loopDurationSec: number): number {
  if (!(loopDurationSec > 0) || !(t > 0)) return 0;
  const period = 2 * loopDurationSec;
  const phase = t % period;
  return phase <= loopDurationSec ? phase : period - phase;
}

/** Per-output-frame source timestamps for a ping-ponged background. */
export function pingPongTimestamps(
  totalFrames: number,
  fps: number,
  loopDurationSec: number
): number[] {
  if (totalFrames <= 0 || fps <= 0 || loopDurationSec <= 0) return [];
  const out = new Array<number>(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    out[i] = pingPongTime(i / fps, loopDurationSec);
  }
  return out;
}

/**
 * Output frames in one complete ping-pong cycle (forward then reverse).
 *
 * This is the length the baked preview asset must be for its own `loop=true`
 * wrap to land on the seamless point rather than reintroducing a cut.
 */
export function pingPongCycleFrames(loopDurationSec: number, fps: number): number {
  if (loopDurationSec <= 0 || fps <= 0) return 0;
  return Math.max(1, Math.round(2 * loopDurationSec * fps));
}
