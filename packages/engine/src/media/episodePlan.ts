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
 * Episode then costs nine of the 15 requests an hour `/api/transcribe`
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
 * it to 96 kbps, which puts a chunk near 7 MB; 32 kbps is MPEG-2 Layer III at
 * 16 kHz, plenty for speech. This is why there is no PCM fallback: 16 kHz
 * 16-bit WAV is 256 kbps, and a 10-minute chunk of it is over four times the
 * body limit.
 */
export const CHUNK_BITRATE_BPS: Record<IngestStrategy, number> = {
  opus: 38_000,
  mp3: 32_000,
};

/**
 * Encoded size of the largest chunk the plan can produce — one full window
 * from planChunkWindows. Container framing is not counted.
 */
export function worstCaseChunkBytes(bitrateBps: number): number {
  return (CHUNK_SEC * bitrateBps) / 8;
}

export function planChunkWindows(
  durationSec: number,
  chunkSec: number
): Array<{ start: number; end: number }> {
  if (durationSec <= 0 || chunkSec <= 0) return [];
  const windows: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < durationSec; start += chunkSec) {
    windows.push({ start, end: Math.min(start + chunkSec, durationSec) });
  }
  return windows;
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
