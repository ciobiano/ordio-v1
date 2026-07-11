/**
 * Pure planning + accumulation logic for the long-episode ingestion path.
 * No DOM, no WebCodecs — fully unit-testable.
 */

export const MAX_EPISODE_SEC = 90 * 60; // design: hard reject above 90 min
/** Files longer than this route to the episode pipeline instead of processAudio. */
export const EPISODE_ROUTE_THRESHOLD_SEC = 15 * 60;
export const OPUS_CHUNK_SEC = 600; // ~10 min per design
export const WAV_CHUNK_SEC = 300; // ~5 min on WAV fallback
const SPARSE_WORDS_PER_MIN = 30;

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
