// Shared long-episode routing decision, used by both the mobile create flow
// (useCreateFlow.ts) and the desktop studio flow (useStudioFlow.ts) so a
// dropped/uploaded file routes to the clip-finder pipeline the same way on
// both surfaces.
import { EPISODE_ROUTE_THRESHOLD_SEC } from '@Ordio/engine/media/episodePlan';
import { MAX_FILE_SIZE_BYTES } from '@/lib/fileValidation';

/** Fast duration probe via metadata only (no decode). Returns null on any failure. */
async function probeDurationSec(file: File): Promise<number | null> {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      return await input.computeDuration();
    } finally {
      input.dispose();
    }
  } catch {
    return null;
  }
}

/**
 * Conservative lower bound on audio bitrate (bits/sec). Real-world audio is
 * essentially never encoded below this — used only to compute a byte-size
 * floor below which a file physically cannot contain
 * EPISODE_ROUTE_THRESHOLD_SEC seconds of audio.
 */
export const MIN_PLAUSIBLE_AUDIO_BITRATE_BPS = 32_000;

/**
 * Byte-size floor below which a file cannot possibly hold more than
 * EPISODE_ROUTE_THRESHOLD_SEC seconds of audio, even at the lowest plausible
 * bitrate. Files under this size skip the async duration probe entirely and
 * go straight to the existing (synchronous) short-path validation — this is
 * a heuristic, not a hard guarantee: a real long file with an unusually low
 * bitrate could fall under this floor and be misrouted to the short path,
 * but that just means it hits validateFile's normal checks like any file
 * does today, so it is not a regression.
 *
 * Math: EPISODE_ROUTE_THRESHOLD_SEC (900s) * 32_000 bps / 8 bits-per-byte
 * = 3,600,000 bytes (~3.43 MiB).
 */
const PROBE_SKIP_SIZE_BYTES =
  (EPISODE_ROUTE_THRESHOLD_SEC * MIN_PLAUSIBLE_AUDIO_BITRATE_BPS) / 8;

/**
 * True if `file` should route to the long-episode clip-finder pipeline
 * instead of the short-path staged-file confirm flow. The duration probe is
 * metadata-only and fails closed: any error (corrupt file, unsupported
 * container, etc.) falls through to the short-path validation, unchanged.
 *
 * Perf: skips the async probe entirely for files too small to possibly be
 * long episodes (see PROBE_SKIP_SIZE_BYTES) — keeps the overwhelming
 * majority of short-file uploads fully synchronous.
 */
export async function isEpisodeFile(file: File): Promise<boolean> {
  const tooBigForShortPath = file.size > MAX_FILE_SIZE_BYTES;
  const couldBeLongEpisode = file.size >= PROBE_SKIP_SIZE_BYTES;
  const durationSec = couldBeLongEpisode ? await probeDurationSec(file) : null;
  return (
    (durationSec !== null && durationSec > EPISODE_ROUTE_THRESHOLD_SEC) ||
    tooBigForShortPath // too big for the short path — try episode path
  );
}
