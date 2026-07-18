/**
 * Client-side transcode of a user-uploaded background video to the same
 * spec as the curated library: ≤10s (trimmed, not rejected), 720p H.264,
 * low bitrate, no audio. Runs fully in-browser via Mediabunny's Conversion
 * API — no partial upload ever reaches storage if this fails.
 */

export const BACKGROUND_MAX_DURATION_SEC = 10;
export const BACKGROUND_TARGET_HEIGHT = 720;
export const BACKGROUND_TARGET_BITRATE = 1_500_000; // ~1.5Mbps ≈ ≤2MB @10s (testing budget)

export interface TranscodedBackground {
  blob: Blob;
  durationSec: number;
}

/** Clamp a source duration to the background spec. Pure — unit-testable. */
export function clampBackgroundDuration(sourceDurationSec: number): number {
  if (sourceDurationSec <= 0) return 0;
  return Math.min(sourceDurationSec, BACKGROUND_MAX_DURATION_SEC);
}

export async function transcodeBackgroundUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<TranscodedBackground> {
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } =
    await import('mediabunny');

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const sourceDuration = await input.computeDuration();
  const durationSec = clampBackgroundDuration(sourceDuration);
  if (durationSec === 0) {
    input.dispose();
    throw new Error('This file has no playable video.');
  }

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });

  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: 0, end: durationSec },
    video: {
      height: BACKGROUND_TARGET_HEIGHT,
      bitrate: BACKGROUND_TARGET_BITRATE,
    },
    audio: { discard: true },
  });

  if (!conversion.isValid) {
    input.dispose();
    throw new Error('This video cannot be converted in this browser.');
  }

  if (onProgress) conversion.onProgress = onProgress;

  await conversion.execute();

  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
  if (!buffer) throw new Error('Transcode produced no output.');

  return {
    blob: new Blob([buffer], { type: 'video/mp4' }),
    durationSec,
  };
}
