/**
 * Curated background-loop manifest — the single source of truth for the
 * picker and the loader. Expanding the library is purely adding files under
 * public/backgrounds/ and entries here; no code changes.
 *
 * Assets: real-life footage (Pexels free license), transcoded to ≤10s,
 * 720p H.264, ≤2.5MB (testing budget — tighten when data-cost work lands).
 */

export interface CuratedBackground {
  id: string;
  label: string;
  videoPath: string;
  thumbPath: string;
}

export const BACKGROUND_LIBRARY: CuratedBackground[] = [
  {
    id: 'cafe',
    label: 'Café meeting',
    videoPath: '/backgrounds/cafe.mp4',
    thumbPath: '/backgrounds/cafe-thumb.jpg',
  },
  {
    id: 'podcast',
    label: 'Podcast mic',
    videoPath: '/backgrounds/podcast.mp4',
    thumbPath: '/backgrounds/podcast-thumb.jpg',
  },
  {
    id: 'friends',
    label: 'Friends talking',
    videoPath: '/backgrounds/friends.mp4',
    thumbPath: '/backgrounds/friends-thumb.jpg',
  },
];

export function getCuratedBackground(id: string): CuratedBackground | null {
  return BACKGROUND_LIBRARY.find((b) => b.id === id) ?? null;
}
