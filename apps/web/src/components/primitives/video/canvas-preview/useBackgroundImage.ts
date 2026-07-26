import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import type { Background } from '@Ordio/shared/schemas';
import { loadCustomBackgroundImage } from '@Ordio/engine/loaders/backgroundLoader';

interface UseBackgroundImageResult {
  bgImage: HTMLImageElement | null;
  bgImageLoading: boolean;
}

/**
 * Loads the selected custom image background — no curated library, so no
 * play/pause lifecycle to manage (unlike useBackgroundVideo, a static image
 * has no playback state at all).
 */
export function useBackgroundImage(background: Background | undefined): UseBackgroundImageResult {
  const bgIsImage = background?.type === 'image';
  const bgAssetId = bgIsImage ? background.assetId : null;
  const customImageUrl = useQuery(
    api.backgrounds.getBackgroundUrl,
    bgIsImage && bgAssetId ? { assetId: bgAssetId as GenericId<'backgroundAssets'> } : 'skip'
  );
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgImageLoading, setBgImageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!bgIsImage || !bgAssetId || !customImageUrl) {
      setBgImage(null);
      setBgImageLoading(false);
      return;
    }

    setBgImageLoading(true);
    loadCustomBackgroundImage(bgAssetId, customImageUrl)
      .then((img) => {
        if (!cancelled) setBgImage(img);
      })
      .catch(() => {
        // Asset failed to load — fall back to solid color, never a broken preview
        if (!cancelled) setBgImage(null);
      })
      .finally(() => {
        if (!cancelled) setBgImageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bgIsImage, bgAssetId, customImageUrl]);

  return { bgImage, bgImageLoading };
}
