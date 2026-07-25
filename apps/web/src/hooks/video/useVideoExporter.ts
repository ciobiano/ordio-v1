'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import type { ConvexReactClient } from 'convex/react';
import type { Background } from '@Ordio/shared/schemas';
import { useUIStore, useProcessingStore } from '@/stores';
import { encodeVideo, hasWebCodecsSupport } from '@Ordio/engine/video';
import { encodeVideoFFmpeg } from '@Ordio/engine/video';
import { getCuratedBackground } from '@Ordio/engine/backgrounds/backgroundLibrary';

/**
 * Fetch the selected video background as a Blob for export compositing.
 * Any failure returns undefined — export falls back to the solid color,
 * never a broken export. (The ffmpeg.wasm path never composites video;
 * the picker disables the option where WebCodecs is unavailable.)
 */
async function resolveBackgroundBlob(
  background: Background | undefined,
  convex: ConvexReactClient,
  signal: AbortSignal
): Promise<Blob | undefined> {
  if (background?.type !== 'video' || !hasWebCodecsSupport()) return undefined;
  try {
    const url =
      background.source === 'curated'
        ? (getCuratedBackground(background.assetId)?.videoPath ?? null)
        : await convex.query(api.backgrounds.getBackgroundUrl, {
            assetId: background.assetId as GenericId<'backgroundAssets'>,
          });
    if (!url) return undefined;
    const res = await fetch(url, { signal });
    if (!res.ok) return undefined;
    return await res.blob();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return undefined;
  }
}

interface UseVideoExporterReturn {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}

function fileExtension(mimeType: string): string {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function useVideoExporter(): UseVideoExporterReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportMimeType, setExportMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const convex = useConvex();

  const startExport = useCallback(
    async (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark = false) => {
      try {
        setError(null);
        setExportProgress(0);

        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
          prevUrlRef.current = null;
        }

        setIsExporting(true);

        const abortController = new AbortController();
        abortRef.current = abortController;

        // Read current style/variant state from store
        const { transcript, captionGroups } = useProcessingStore.getState();
        const { style, waveformStyle, canvasLayout, graphicStyle, captionTransform } = useUIStore.getState();

        const backgroundVideo = await resolveBackgroundBlob(
          style.background,
          convex,
          abortController.signal
        );

        const encode = hasWebCodecsSupport() ? encodeVideo : encodeVideoFFmpeg;
        const result = await encode({
          canvas,
          audioBuffer,
          transcript,
          captionGroups,
          style,
          waveformStyle,
          canvasLayout,
          showWatermark,
          graphicStyle,
          captionTransform,
          backgroundVideo,
          onProgress: (progress) => setExportProgress(progress * 100),
          signal: abortController.signal,
        });

        const url = URL.createObjectURL(result.blob);
        prevUrlRef.current = url;
        setExportedUrl(url);
        setExportMimeType(result.mimeType);
        setExportProgress(100);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Cancelled by user — not an error
          return;
        }
        setError(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setIsExporting(false);
        abortRef.current = null;
      }
    },
    [convex]
  );

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    setIsExporting(false);
    setExportProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return {
    isExporting,
    exportProgress,
    exportedUrl,
    exportMimeType,
    error,
    startExport,
    cancelExport,
  };
}

export { fileExtension };
