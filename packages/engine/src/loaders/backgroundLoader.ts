/**
 * Lazy-load + cache background loop videos, mirroring graphicLoader.ts.
 *
 * Curated assets resolve from the static manifest; custom assets are loaded
 * from a caller-supplied URL (Convex storage URLs are signed/per-user, so
 * the React layer resolves them via api.backgrounds.getBackgroundUrl and
 * passes the URL down — this module stays hook-free).
 */
import { getCuratedBackground } from '../backgrounds/backgroundLibrary';
import { getCanvasPreset } from '../backgrounds/canvasPresets';

const cache = new Map<string, HTMLVideoElement>();

function cacheKey(source: 'curated' | 'custom', assetId: string): string {
  return `${source}:${assetId}`;
}

/**
 * Hand the source URL straight to a video element and let the browser loop it.
 *
 * This briefly did something cleverer: fetch the file, re-encode it as a
 * forward+reverse "ping-pong" cycle so the loop had no visible seam, and play
 * that instead. It made every background hang on a spinner forever.
 *
 * The reversal fed non-monotonic timestamps to mediabunny's
 * `samplesAtTimestamps`, which documents that it takes an optimized path *only*
 * when timestamps are monotonically sorted. Descending ones re-decode from the
 * previous keyframe every step — roughly 9,000 frame-decodes for one 10s loop —
 * and it ran at load time with `bgLoading` held true throughout.
 *
 * The seam is a real defect and worth fixing, but it needs a reversal that
 * decodes forward in bounded windows and emits each window backwards, so the
 * decoder keeps its fast path. Until that exists, a visible cut every 10s beats
 * a background that never appears.
 */
function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  return new Promise<void>((res, rej) => {
    video.onloadeddata = () => res();
    video.onerror = () => rej(new Error(`Failed to load background video: ${url}`));
  }).then(() => video);
}

async function loadVideo(key: string, url: string): Promise<HTMLVideoElement> {
  const cached = cache.get(key);
  if (cached) return cached;

  const video = await loadVideoElement(url);

  // Another caller may have loaded this while we awaited; keep the winner.
  const raced = cache.get(key);
  if (raced) return raced;

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

// --- Image backgrounds: 'preset' (bundled canvas artwork) or 'custom' (user upload). ---

const imageCache = new Map<string, HTMLImageElement>();

function imageCacheKey(source: 'preset' | 'custom', assetId: string): string {
  return `image:${source}:${assetId}`;
}

async function loadImage(key: string, url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(key);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;

  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Failed to load background image: ${key}`));
  });

  imageCache.set(key, img);
  return img;
}

/** Bundled canvas-preset artwork: static path, no signed URL or Convex round trip needed. */
export async function loadPresetBackgroundImage(assetId: string): Promise<HTMLImageElement> {
  const preset = getCanvasPreset(assetId);
  if (!preset) throw new Error(`Unknown canvas preset: ${assetId}`);
  return loadImage(imageCacheKey('preset', assetId), preset.imagePath);
}

/** Custom image uploads: caller resolves the signed Convex URL first, same as loadCustomBackground. */
export async function loadCustomBackgroundImage(
  assetId: string,
  url: string
): Promise<HTMLImageElement> {
  return loadImage(imageCacheKey('custom', assetId), url);
}

export function getLoadedBackgroundImage(
  source: 'preset' | 'custom',
  assetId: string
): HTMLImageElement | null {
  return imageCache.get(imageCacheKey(source, assetId)) ?? null;
}
