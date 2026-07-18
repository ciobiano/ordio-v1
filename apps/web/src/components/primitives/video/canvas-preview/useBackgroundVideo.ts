import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import type { Background } from '@Ordio/shared/schemas';
import { loadCuratedBackground, loadCustomBackground } from '@Ordio/engine/loaders/backgroundLoader';

interface UseBackgroundVideoResult {
  bgVideo: HTMLVideoElement | null;
  bgLoading: boolean;
}

/**
 * Loads and autoplays the selected video background, keeping its playback
 * in lockstep with the audio-driven preview (see CanvasPreview render loop —
 * preview and export share the same composite path, so the loop must not
 * drift while the transcript is paused).
 */
export function useBackgroundVideo(
  background: Background | undefined,
  isPlaying: boolean
): UseBackgroundVideoResult {
  const bgIsVideo = background?.type === 'video';
  const bgSource = bgIsVideo ? background.source : null;
  const bgAssetId = bgIsVideo ? background.assetId : null;
  const customBgUrl = useQuery(
    api.backgrounds.getBackgroundUrl,
    bgIsVideo && bgSource === 'custom'
      ? { assetId: bgAssetId as GenericId<'backgroundAssets'> }
      : 'skip'
  );
  const [bgVideo, setBgVideo] = useState<HTMLVideoElement | null>(null);
  const [bgLoading, setBgLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!bgIsVideo || !bgAssetId) {
      setBgVideo(null);
      setBgLoading(false);
      return;
    }
    const loadPromise =
      bgSource === 'curated'
        ? loadCuratedBackground(bgAssetId)
        : customBgUrl
          ? loadCustomBackground(bgAssetId, customBgUrl)
          : null;
    if (!loadPromise) return; // custom URL still resolving

    setBgLoading(true);
    loadPromise
      .then((video) => {
        if (cancelled) return;
        setBgVideo(video);
      })
      .catch(() => {
        // Asset failed to load — fall back to solid color, never a broken preview
        if (!cancelled) setBgVideo(null);
      })
      .finally(() => {
        if (!cancelled) setBgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bgIsVideo, bgSource, bgAssetId, customBgUrl]);

  useEffect(() => {
    if (!bgVideo) return;
    if (isPlaying) {
      void bgVideo.play().catch(() => {});
    } else {
      bgVideo.pause();
    }
  }, [bgVideo, isPlaying]);

  return { bgVideo, bgLoading };
}
