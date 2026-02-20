'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVideoExporterReturn {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer) => Promise<void>;
  cancelExport: () => void;
}

/**
 * Prefer MP4 (H.264/AAC) — the universal social media format.
 * MediaRecorder supports `video/mp4` in Chrome 130+ on most platforms.
 * Falls back to WebM if MP4 is unavailable (Firefox, older Chrome).
 */
function detectMimeType(): string {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm'; // last resort
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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const startExport = useCallback(
    async (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer) => {
      try {
        setError(null);
        setExportProgress(0);
        cancelledRef.current = false;

        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
          prevUrlRef.current = null;
        }

        setIsExporting(true);

        const mimeType = detectMimeType();
        const duration = audioBuffer.duration;
        const fps = 30;

        const audioCtx = new AudioContext();
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        const audioDestination = audioCtx.createMediaStreamDestination();
        source.connect(audioDestination);

        const videoStream = canvas.captureStream(fps);
        audioDestination.stream.getAudioTracks().forEach((track) =>
          videoStream.addTrack(track)
        );

        const recorder = new MediaRecorder(videoStream, { mimeType });
        recorderRef.current = recorder;

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          audioCtx.close();
          if (!cancelledRef.current) {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            prevUrlRef.current = url;
            setExportedUrl(url);
            setExportMimeType(mimeType);
            setExportProgress(100);
          }
          setIsExporting(false);
        };

        recorder.start(100);
        source.start();

        // Progress tracking via AudioContext time
        const startTime = audioCtx.currentTime;
        const updateProgress = () => {
          if (cancelledRef.current) return;
          const elapsed = audioCtx.currentTime - startTime;
          const pct = Math.min((elapsed / duration) * 100, 99);
          setExportProgress(pct);
          if (elapsed < duration) requestAnimationFrame(updateProgress);
        };
        requestAnimationFrame(updateProgress);

        source.onended = () => {
          if (!cancelledRef.current && recorder.state === 'recording') {
            recorder.stop();
          }
        };
      } catch (err) {
        setIsExporting(false);
        setError(err instanceof Error ? err.message : 'Export failed');
      }
    },
    []
  );

  const cancelExport = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
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
