'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { toast } from 'sonner';
import { useUIStore, useProcessingStore, useCaptureStore } from '@/stores';
import { useVideoExporter, fileExtension } from '@/hooks/video/useVideoExporter';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useExportGate } from '@/hooks/billing/useExportGate';
import type { GenericId } from 'convex/values';
import { decodeBlobToAudioBuffer } from '@/lib/media';
import ExportScreen from '@/components/soul/export/ExportScreen';


export default function ExportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const { audioBuffer, setAudioBuffer, setAudioBlob, setAudioDuration } = useCaptureStore();

  const { setTranscript } = useProcessingStore();

  const { setUpgradeTarget, format, waveformStyle, canvasLayout, captionMode, graphicStyle } =
    useUIStore();

  const resetUI = useUIStore((s) => s.resetUI);
  const resetCapture = useCaptureStore((s) => s.resetCapture);
  const resetProcessing = useProcessingStore((s) => s.resetProcessing);

  const reset = useCallback(() => {
    resetCapture();
    resetProcessing();
    resetUI();
  }, [resetCapture, resetProcessing, resetUI]);

  const [isHydrating, setIsHydrating] = useState(false);

  const session = useQuery(api.sessions.getSession, {
    sessionId: sessionId as GenericId<'sessions'>,
  });

  const audioUrlResult = useQuery(
    api.sessions.getAudioUrl,
    session ? { sessionId: sessionId as GenericId<'sessions'> } : 'skip'
  );

  const exporter = useVideoExporter();
  const playback = usePlayback();
  const loadAudio = playback.load;
  const { tier } = useCurrentUser();
  const exportGate = useExportGate();

  // Guard: session undefined = loading; null = not found/expired
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      toast.error('This recording has expired or could not be found.');
      router.replace('/create');
    }
  }, [session, router]);

  // Hydrate audio from Convex storage when arriving via direct navigation
  useEffect(() => {
    if (!session || !audioUrlResult || audioBuffer) return;
    if (isHydrating) return;

    setIsHydrating(true);

    const hydrate = async () => {
      try {
        const res = await fetch(audioUrlResult);
        const arrayBuf = await res.arrayBuffer();

        const blob = new Blob([arrayBuf], { type: session.mimeType });
        const { audioBuffer: decoded } = await decodeBlobToAudioBuffer(blob);
        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setTranscript(session.transcript);
      } catch {
        toast.error('Failed to load your recording.');
        router.replace('/create');
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrate();
  }, [
    session,
    audioUrlResult,
    audioBuffer,
    isHydrating,
    setAudioBuffer,
    setAudioBlob,
    setAudioDuration,
    setTranscript,
    router,
  ]);


  useEffect(() => {
    if (audioBuffer) loadAudio(audioBuffer);
  }, [audioBuffer, loadAudio]);

  const handleExportStart = useCallback(async (): Promise<boolean> => {
    const gate = await exportGate.checkAndConsume();
    if (!gate.allowed) {
      setUpgradeTarget('export_limit');
      return false;
    }
    return true;
  }, [exportGate, setUpgradeTarget]);

  const handleDownload = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  const handleReset = useCallback(() => {
    exporter.cancelExport();
    playback.stop();
    reset();
    router.push('/create');
  }, [exporter, playback, reset, router]);

  // Loading state: undefined = still fetching
  if (session === undefined || isHydrating || !audioBuffer) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  // Error state: null = expired/not found; redirect is async via effect
  if (session === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-white/40 text-sm">Recording not found. Redirecting…</p>
      </div>
    );
  }

    return (
    <main
      id="main-content"
      className="min-h-dvh flex items-center justify-center relative"
    >
      <ExportScreen
        playback={playback}
        exporter={exporter}
        format={format}
        waveformStyle={waveformStyle}
        captionMode={captionMode}
        canvasLayout={canvasLayout}
        graphicStyle={graphicStyle}
        showWatermark={tier === 'free'}
        onExportStart={handleExportStart}
        onDownload={handleDownload}
        onReset={handleReset}
        onLocked={setUpgradeTarget}
      />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Export ready
      </div>
    </main>
  );
}
