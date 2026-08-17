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
import { bakePingPongLoop } from '../media/bakePingPongLoop';
import { FPS } from '@Ordio/shared/time';

const cache = new Map<string, HTMLVideoElement>();
/** Object URLs for baked loops, kept alive as long as their cached element. */
const bakedUrls = new Map<string, string>();

function cacheKey(source: 'curated' | 'custom', assetId: string): string {
  return `${source}:${assetId}`;
}

function attachVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  // Safe to loop natively: the source is a baked forward+reverse cycle, so the
  // wrap point is the seamless one. On the un-baked fallback path this still
  // cuts, which is the old behaviour and better than no background at all.
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  return new Promise<void>((res, rej) => {
    video.onloadeddata = () => res();
    video.onerror = () => rej(new Error(`Failed to load background video: ${url}`));
  }).then(() => video);
}

/**
 * Fetch a loop and bake it into a seamless forward+reverse cycle before handing
 * it to a video element. See media/bakePingPongLoop for why the reversal has to
 * happen here rather than by seeking during playback.
 *
 * A bake failure degrades to the original asset rather than propagating: the
 * background then cuts at the wrap exactly as it used to, which is a visual
 * regression but not a broken preview.
 */
async function loadVideo(key: string, url: string): Promise<HTMLVideoElement> {
  const cached = cache.get(key);
  if (cached) return cached;

  let playbackUrl = url;
  let bakedUrl: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch background video: ${key}`);
    const { blob } = await bakePingPongLoop(await res.blob(), FPS);
    bakedUrl = URL.createObjectURL(blob);
    playbackUrl = bakedUrl;
  } catch {
    // Fall through to the un-baked source URL.
  }

  let video: HTMLVideoElement;
  try {
    video = await attachVideo(playbackUrl);
  } catch (err) {
    if (bakedUrl) URL.revokeObjectURL(bakedUrl);
    throw err;
  }

  // Another caller may have populated the cache while we were baking. Keep the
  // winner and release our redundant blob so it does not leak.
  const raced = cache.get(key);
  if (raced) {
    if (bakedUrl) URL.revokeObjectURL(bakedUrl);
    return raced;
  }

  cache.set(key, video);
  if (bakedUrl) bakedUrls.set(key, bakedUrl);
  return video;
}

/** Release cached loops and their baked blobs. */
export function clearBackgroundVideoCache(): void {
  for (const url of bakedUrls.values()) URL.revokeObjectURL(url);
  bakedUrls.clear();
  cache.clear();
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
