import type { CaptionDisplaySegment } from './types';

export function findActiveDisplaySegment(
  segments: CaptionDisplaySegment[],
  currentTime: number
): CaptionDisplaySegment | null {
  if (segments.length === 0) return null;

  const active = segments.find(
    (segment) => currentTime >= segment.start && currentTime < segment.end
  );
  if (active) return active;

  if (currentTime < segments[0].start) return segments[0];
  return segments[segments.length - 1];
}
