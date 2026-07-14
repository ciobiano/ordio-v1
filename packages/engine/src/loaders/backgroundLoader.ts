/**
 * Lazy-load + cache background loop videos, mirroring graphicLoader.ts.
 *
 * Curated assets resolve from the static manifest; custom assets are loaded
 * from a caller-supplied URL (Convex storage URLs are signed/per-user, so
 * the React layer resolves them via api.backgrounds.getBackgroundUrl and
 * passes the URL down — this module stays hook-free).
 */
import { getCuratedBackground } from '../backgrounds/backgroundLibrary';

const cache = new Map<string, HTMLVideoElement>();

function cacheKey(source: 'curated' | 'custom', assetId: string): string {
  return `${source}:${assetId}`;
}

async function loadVideo(key: string, url: string): Promise<HTMLVideoElement> {
  const cached = cache.get(key);
  if (cached) return cached;

  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  await new Promise<void>((res, rej) => {
    video.onloadeddata = () => res();
    video.onerror = () => rej(new Error(`Failed to load background video: ${key}`));
  });

  cache.set(key, video);
  return video;
}

export async function loadCuratedBackground(assetId: string): Promise<HTMLVideoElement> {
  const asset = getCuratedBackground(assetId);
  if (!asset) throw new Error(`Unknown curated background: ${assetId}`);
  return loadVideo(cacheKey('curated', assetId), asset.videoPath);
}

/** Custom uploads: caller resolves the signed Convex URL first. */
export async function loadCustomBackground(
  assetId: string,
  url: string
): Promise<HTMLVideoElement> {
  return loadVideo(cacheKey('custom', assetId), url);
}

export function getLoadedBackground(
  source: 'curated' | 'custom',
  assetId: string
): HTMLVideoElement | null {
  return cache.get(cacheKey(source, assetId)) ?? null;
}
