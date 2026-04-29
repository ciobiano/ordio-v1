'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore, useProcessingStore } from '@/stores';
import { encodeVideo, hasWebCodecsSupport } from '@/lib/video';
import { encodeVideoFFmpeg } from '@/lib/video';

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
        const { style, waveformStyle, captionMode, captionAnimation, canvasLayout, graphicStyle } = useUIStore.getState();

        const encode = hasWebCodecsSupport() ? encodeVideo : encodeVideoFFmpeg;
        const result = await encode({
          canvas,
          audioBuffer,
          transcript,
          captionGroups,
          style,
          waveformStyle,
          captionMode,
          captionAnimation,
          canvasLayout,
          showWatermark,
          graphicStyle,
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
    []
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
