/**
 * Pure planning + accumulation logic for the long-episode ingestion path.
 * No DOM, no WebCodecs — fully unit-testable.
 */
import type { IngestStrategy } from './audioCodecSupport';

export const MAX_EPISODE_SEC = 90 * 60; // design: hard reject above 90 min
/** Files longer than this route to the episode pipeline instead of processAudio. */
export const EPISODE_ROUTE_THRESHOLD_SEC = 15 * 60;
/**
 * ~10 min per chunk, whichever codec the browser can encode — a 90-minute
 * Episode then costs at most ten of the 15 requests an hour `/api/transcribe`
 * allows, leaving room for retries.
 */
export const CHUNK_SEC = 600;
const SPARSE_WORDS_PER_MIN = 30;

/**
 * Vercel Functions refuse a request body over 4.5 MB with 413
 * FUNCTION_PAYLOAD_TOO_LARGE before the route runs, and no route config
 * raises it. Each chunk is one request body.
 */
export const UPLOAD_BODY_LIMIT_BYTES = 4_500_000;

/**
 * The bitrate each chunk is encoded at. Opus 38 kbps is what mediabunny's
 * QUALITY_LOW resolves to. MP3 is set explicitly because QUALITY_LOW resolves
 * it to 96 kbps, which puts a chunk near 8 MB; 32 kbps is MPEG-2 Layer III at
 * 16 kHz, plenty for speech. This is why there is no PCM fallback: 16 kHz
 * 16-bit WAV is 256 kbps, and a 10-minute chunk of it is over four times the
 * body limit.
 */
export const CHUNK_BITRATE_BPS: Record<IngestStrategy, number> = {
  opus: 38_000,
  mp3: 32_000,
};

/**
 * A leftover shorter than this is folded into the window before it rather than
 * sent as a request of its own. `/api/transcribe` allows 15 requests an hour,
 * and pause-aligned cuts land a few seconds early, so without this a 90-minute
 * Episode grows a tenth request to carry its last minute.
 */
export const TAIL_ABSORB_SEC = 90;
/** How far back from a window's nominal end to look for a pause to cut at. */
export const CUT_SEARCH_SEC = 15;

/**
 * Where the window starting at `start` should stop decoding. The cut itself
 * happens later, at a pause, unless this is the last window.
 */
export function nextWindowEnd(
  start: number,
  durationSec: number,
  chunkSec: number
): { end: number; isLast: boolean } {
  const end = start + chunkSec;
  if (durationSec - end < TAIL_ABSORB_SEC) return { end: durationSec, isLast: true };
  return { end, isLast: false };
}

/**
 * Encoded size of the largest chunk the plan can produce: the last window,
 * carrying up to TAIL_ABSORB_SEC of leftover. Container framing is not counted.
 */
export function worstCaseChunkBytes(bitrateBps: number): number {
  return ((CHUNK_SEC + TAIL_ABSORB_SEC) * bitrateBps) / 8;
}

const CUT_FRAME_SEC = 0.1;
/**
 * The cut is placed in the quietest 300ms span, not the quietest 100ms frame:
 * the closure before a plosive is a 50–150ms silence inside a word, and a
 * frame-sized minimum would happily cut "ca|ptain" in half. A real pause
 * between words is longer than that.
 */
const CUT_SPAN_FRAMES = 3;

/**
 * Seconds from the start of `samples` at which to end a chunk: the centre of
 * the quietest span in the last `searchSec`. Ties go to the later span, so a
 * window of uniform level is cut as close to its nominal end as possible.
 *
 * Whisper decodes each word using the words before it, and a chunk seam
 * throws that context away — the eval found seams to be where substitutions
 * and insertions cluster. Cutting mid-word makes it worse: both halves of the
 * word are transcribed as something else. Cutting in a pause leaves only the
 * context loss.
 */
export function findQuietCut(samples: Float32Array, sampleRate: number, searchSec: number): number {
  const frameLen = Math.max(1, Math.round(sampleRate * CUT_FRAME_SEC));
  const totalFrames = Math.floor(samples.length / frameLen);
  const searchFrames = Math.min(totalFrames, Math.round(searchSec / CUT_FRAME_SEC));
  if (searchFrames < CUT_SPAN_FRAMES) return samples.length / sampleRate;

  const firstFrame = totalFrames - searchFrames;
  const frameEnergy: number[] = [];
  for (let f = firstFrame; f < totalFrames; f++) {
    let sum = 0;
    for (let i = f * frameLen; i < (f + 1) * frameLen; i++) sum += samples[i]! * samples[i]!;
    frameEnergy.push(sum);
  }

  let best = 0;
  let bestSum = Infinity;
  for (let i = 0; i + CUT_SPAN_FRAMES <= frameEnergy.length; i++) {
    let sum = 0;
    for (let k = 0; k < CUT_SPAN_FRAMES; k++) sum += frameEnergy[i + k]!;
    if (sum <= bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  const centreSample = (firstFrame + best) * frameLen + (CUT_SPAN_FRAMES * frameLen) / 2;
  return centreSample / sampleRate;
}

export function isSparseTranscript(wordCount: number, durationSec: number): boolean {
  if (durationSec <= 0) return true;
  return wordCount / (durationSec / 60) < SPARSE_WORDS_PER_MIN;
}

/**
 * Accumulates per-second RMS energy across streamed sample chunks.
 * finish() normalizes to 0–1 (all-silence input yields all zeros).
 */
export function createEnergyAccumulator(durationSec: number) {
  const seconds = Math.max(1, Math.ceil(durationSec));
  const sumSquares = new Float64Array(seconds);
  const counts = new Float64Array(seconds);

  return {
    add(samples: Float32Array, chunkStartSec: number, sampleRate: number): void {
      for (let i = 0; i < samples.length; i++) {
        const sec = Math.min(seconds - 1, Math.floor(chunkStartSec + i / sampleRate));
        const v = samples[i]!;
        sumSquares[sec]! += v * v;
        counts[sec]! += 1;
      }
    },
    finish(): number[] {
      const rms = Array.from({ length: seconds }, (_, s) =>
        counts[s]! > 0 ? Math.sqrt(sumSquares[s]! / counts[s]!) : 0
      );
      const max = Math.max(...rms);
      return max > 0 ? rms.map((v) => v / max) : rms;
    },
  };
}
