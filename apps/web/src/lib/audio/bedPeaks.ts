/**
 * A peak outline for a dropped sound, so its block can be trimmed by eye.
 *
 * TimelineDeck argues against a waveform row for the *voice*, and it is right:
 * the stage plays the clip back and already draws that amplitude, so a second
 * read-out of the same signal costs height and says nothing new. A bed is the
 * opposite case — the stage never draws it, so without peaks its block is a
 * rectangle with a filename on it and "trim to exactly the part you want"
 * means dragging blind.
 *
 * Peaks are computed once per dropped file. Decoding is the expensive half
 * (a multi-megabyte file, fully into memory), and a trim drag can fire sixty
 * times a second, so nothing here may run during a drag.
 */

/** How many peak columns to sample. Enough for a wide block, cheap to hold. */
const PEAK_COUNT = 400;

export interface BedSource {
  /** Normalised 0–1 peak per column, across the whole untrimmed file. */
  peaks: number[];
  /** Source length in seconds. */
  duration: number;
}

/**
 * Decode a sound and reduce it to a peak-per-column outline.
 *
 * Mono-summed: a bed is background, and drawing two channels in a 30px block
 * reads as noise rather than as information.
 */
export async function readBedSource(file: File): Promise<BedSource> {
  const bytes = await file.arrayBuffer();

  /* An OfflineAudioContext decodes without opening an output device, so this
     never fights the recorder or playback for the audio hardware. */
  const context = new OfflineAudioContext(1, 1, 44100);
  const buffer = await context.decodeAudioData(bytes);

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c)
  );
  const perColumn = Math.max(1, Math.floor(buffer.length / PEAK_COUNT));
  const peaks: number[] = [];
  let loudest = 0;

  for (let column = 0; column < PEAK_COUNT; column++) {
    const from = column * perColumn;
    const to = Math.min(buffer.length, from + perColumn);
    let peak = 0;
    for (let i = from; i < to; i++) {
      for (const data of channels) {
        const value = Math.abs(data[i]);
        if (value > peak) peak = value;
      }
    }
    peaks.push(peak);
    if (peak > loudest) loudest = peak;
  }

  /* Normalised to the file's own loudest point, so a quiet sting still draws
     a visible shape instead of a flat line nobody can aim at. */
  const scale = loudest > 0 ? 1 / loudest : 0;
  return { peaks: peaks.map((p) => p * scale), duration: buffer.duration };
}

/**
 * The slice of the outline that survives the current trim.
 *
 * Indexing rather than recomputing: the peaks describe the whole file, and a
 * trim only changes which part of it is on screen. Re-decoding on every drag
 * frame is the difference between a handle that tracks the pointer and one
 * that stutters.
 */
export function visiblePeaks(
  source: BedSource,
  trimIn: number,
  trimOut: number
): number[] {
  if (source.duration <= 0) return [];
  const total = source.peaks.length;
  const from = Math.floor((trimIn / source.duration) * total);
  const to = Math.ceil(((source.duration - trimOut) / source.duration) * total);
  return source.peaks.slice(Math.max(0, from), Math.min(total, Math.max(from + 1, to)));
}
