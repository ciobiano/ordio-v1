'use client';

import { use, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { toast } from 'sonner';
import { useUIStore, useProcessingStore, useCaptureStore } from '@/stores';
import { useVideoExporter, fileExtension } from '@/hooks/video/useVideoExporter';
import { OrdioMark } from '@/components/ui/OrdioMark';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { useExportGate } from '@/hooks/billing/useExportGate';
import type { GenericId } from 'convex/values';
import { decodeBlobToAudioBuffer } from '@Ordio/engine/media';
import ExportState from '@/components/mobile/states/ExportState';


export default function ExportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const { audioBuffer, setAudioBuffer, setAudioBlob, setAudioDuration } = useCaptureStore();

  const { setTranscript } = useProcessingStore();

  const { setUpgradeTarget, format, waveformStyle, canvasLayout, graphicStyle } =
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

  /**
   * Which session we have already pulled audio for.
   *
   * The hydration effect below used to key off `!audioBuffer`, which reads as
   * "we have no audio, go and get it" but actually means "anything that clears
   * the audio re-downloads it". Discard is exactly that: it wipes the stores and
   * navigates away, so clearing the buffer satisfied the guard, and the page
   * re-fetched and re-decoded the recording the user had just thrown away —
   * racing the navigation and putting it back into the store. The discard did
   * not stick and the screen sat on the spinner.
   *
   * Keyed on the session instead, so hydration happens once per recording and
   * an emptied store is left empty.
   */
  const hydratedSessionRef = useRef<string | null>(null);

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
    if (!session || !audioUrlResult) return;
    if (audioBuffer) {
      // Arrived with the recording already in memory — count it as hydrated so
      // a later reset cannot be mistaken for a cold load.
      hydratedSessionRef.current = sessionId;
      return;
    }
    if (hydratedSessionRef.current === sessionId) return;

    hydratedSessionRef.current = sessionId;
    setIsHydrating(true);

    // Discard navigates away mid-flight. Without this the fetch would land
    // afterwards and write the discarded recording back into a global store
    // that the next screen is already reading.
    const controller = new AbortController();

    const hydrate = async () => {
      try {
        const res = await fetch(audioUrlResult, { signal: controller.signal });
        const arrayBuf = await res.arrayBuffer();
        if (controller.signal.aborted) return;

        const blob = new Blob([arrayBuf], { type: session.mimeType });
        const { audioBuffer: decoded } = await decodeBlobToAudioBuffer(blob);
        if (controller.signal.aborted) return;

        setAudioBuffer(decoded);
        setAudioBlob(blob);
        setAudioDuration(decoded.duration);
        setTranscript(session.transcript);
      } catch (err) {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        // Let the next visit retry rather than stranding the user on a spinner.
        hydratedSessionRef.current = null;
        toast.error('Failed to load your recording.');
        router.replace('/create');
      } finally {
        if (!controller.signal.aborted) setIsHydrating(false);
      }
    };

    void hydrate();
    return () => controller.abort();
  }, [
    session,
    sessionId,
    audioUrlResult,
    audioBuffer,
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
      <div className="min-h-dvh flex items-center justify-center bg-acid-bg-base" role="status">
        <span className="sr-only">Loading your recording</span>
        <OrdioMark motion="pulse" size={120} className="text-acid-text-1" />
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

  // Exactly one viewport tall, and full-bleed. The horizontal padding that used
  // to live here kept the header and dock off the screen edges, and min-h-dvh
  // wrapping an h-dvh child made the page taller than the viewport, so the whole
  // screen floated and scrolled. Each region owns its own padding now.
  return (
    <main
      id="main-content"
      className="relative flex h-dvh flex-col overflow-hidden md:h-auto md:min-h-dvh md:overflow-visible"
    >
      <ExportState
        playback={playback}
        exporter={exporter}
        format={format}
        waveformStyle={waveformStyle}
        canvasLayout={canvasLayout}
        graphicStyle={graphicStyle}
        showWatermark
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
