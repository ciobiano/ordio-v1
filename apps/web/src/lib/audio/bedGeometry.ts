/**
 * Where a music bed sits on the timeline, and how dragging changes it.
 *
 * Pure arithmetic, kept out of the component because this is the part that
 * goes wrong: a trim handle dragged past its own opposite edge, a bed pushed
 * to a negative start, a block whose drawn width stops matching the audio it
 * plays. Each of those is silent — the timeline still renders something — so
 * they need to be provable rather than eyeballed.
 */

/** A dropped sound, positioned on the session's timeline. */
export interface BedClip {
  /** Filename, shown on the block and in the Audio panel. */
  name: string;
  /** Object URL for decoding and preview. Revoked when the bed is removed. */
  url: string;
  /** Length of the source file, before any trimming. */
  sourceDuration: number;
  /** Where on the session timeline the audible part begins. */
  startAt: number;
  /** Seconds cut from the head of the source. */
  trimIn: number;
  /** Seconds cut from the tail of the source. */
  trimOut: number;
}

/**
 * A bed shorter than this cannot be trimmed further.
 *
 * Zero would be worse than useless: the block collapses to nothing, so the
 * handles land on top of each other and there is no pointer target left to
 * drag back out. 100ms keeps a grabbable sliver on screen.
 */
export const MIN_BED_SEC = 0.1;

/** How long the bed actually sounds for, after both trims. */
export function bedDuration(bed: BedClip): number {
  return Math.max(0, bed.sourceDuration - bed.trimIn - bed.trimOut);
}

/** The span the bed occupies on the timeline. */
export function bedSpan(bed: BedClip): { start: number; end: number } {
  return { start: bed.startAt, end: bed.startAt + bedDuration(bed) };
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * Convert a pointer position over the track into a time.
 *
 * Clamped to the session, so a drop past the right edge lands at the end
 * rather than scheduling a bed nobody can reach.
 */
export function timeAtX(clientX: number, rect: DOMRect, duration: number): number {
  if (duration <= 0 || rect.width <= 0) return 0;
  return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
}

/**
 * Move the whole bed, keeping its trims.
 *
 * Only the left edge is clamped. Letting a bed start after the voice ends is
 * allowed on purpose — an outro sting is a real thing to want, and the export
 * length is the voice's, so a bed hanging off the end is simply not heard.
 * Refusing the drag would be the app second-guessing a legal arrangement.
 */
export function moveBed(bed: BedClip, toStart: number): BedClip {
  return { ...bed, startAt: Math.max(0, toStart) };
}

/**
 * Drag the left handle.
 *
 * Trimming from the head moves the block's start by the same amount, so the
 * audio under the handle stays where it was on the timeline — the edge moves,
 * the content does not. Dragging left past the source's own beginning is
 * refused rather than clamped silently to zero, so the block stops moving at
 * exactly the point the source runs out.
 */
export function trimBedStart(bed: BedClip, toStart: number): BedClip {
  const latest = bed.startAt + bedDuration(bed) - MIN_BED_SEC;
  const earliest = bed.startAt - bed.trimIn;
  const next = clamp(toStart, Math.max(0, earliest), latest);
  const delta = next - bed.startAt;
  return { ...bed, startAt: next, trimIn: bed.trimIn + delta };
}

/**
 * Drag the right handle.
 *
 * `startAt` is untouched: the head of the bed is already placed, and having
 * it shift while the tail is dragged is the classic way an edit that looked
 * right in the timeline plays back out of time.
 */
export function trimBedEnd(bed: BedClip, toEnd: number): BedClip {
  const earliest = bed.startAt + MIN_BED_SEC;
  const latest = bed.startAt + (bed.sourceDuration - bed.trimIn);
  const next = clamp(toEnd, earliest, latest);
  const audible = next - bed.startAt;
  return { ...bed, trimOut: bed.sourceDuration - bed.trimIn - audible };
}

/** A freshly dropped file, placed where it was let go. */
export function bedFromDrop(
  name: string,
  url: string,
  sourceDuration: number,
  atSecond: number
): BedClip {
  return {
    name,
    url,
    sourceDuration,
    startAt: Math.max(0, atSecond),
    trimIn: 0,
    trimOut: 0,
  };
}
