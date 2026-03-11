'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { UserButton, useClerk, useAuth } from '@clerk/nextjs';
import { useStore, getCanvasDimensions } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useTranscription } from '@/hooks/useTranscription';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';
import { useVideoExporter, fileExtension } from '@/hooks/useVideoExporter';
import { useCapabilities } from '@/hooks/useCapabilities';
import { usePlayback } from '@/hooks/usePlayback';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useExportGate } from '@/hooks/useExportGate';
import { useCheckout } from '@/hooks/useCheckout';
import { useAction } from 'convex/react';
import { anyApi } from 'convex/server';
import type { FeatureKey } from '@/lib/featureGates';

import { CapabilityBanner } from '@/components/primitives';
import {
  AudioSettings,
  CaptionStyleSelector,
  WaveformStyleSelector,
  IdleState,
  RecordingState,
  ProcessingState,
  ExportState,
  UpgradeSheet,
} from '@/components/soul';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function Home() {
  const {
    currentState,
    waveformStyle,
    captionStyle,
    format,
    setCurrentState,
    reset,
  } = useStore();

  const [audioLevel, setAudioLevel] = useState(0);
  const [upgradeTarget, setUpgradeTarget] = useState<FeatureKey | 'export_limit' | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);
  const exporter = useVideoExporter();
  const capabilities = useCapabilities();
  const playback = usePlayback();
  const { tier } = useCurrentUser();
  const exportGate = useExportGate();
  const { openSignIn } = useClerk();
  const { isSignedIn } = useAuth();
  const { startCheckout } = useCheckout();
  const searchParams = useSearchParams();
  const router = useRouter();
  const confirmPaystackPayment = useAction(anyApi.users.confirmPaystackPayment);

  // Audio level animation during recording
  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const tick = () => {
      setAudioLevel(analyser.getAudioLevel());
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [recorder.isRecording, analyser]);

  // Load audio into playback when entering export phase
  useEffect(() => {
    if (currentState !== 'export') return;
    const { audioBuffer } = useStore.getState();
    if (audioBuffer) playback.load(audioBuffer);
  }, [currentState, playback]);

  // Handle post-payment redirect
  useEffect(() => {
    const upgrade = searchParams.get('upgrade');
    if (!upgrade) return;

    if (upgrade === 'stripe-success') {
      toast.success('Payment received! Your account is being upgraded…');
      router.replace('/');
    }

    if (upgrade === 'paystack-success') {
      const reference = searchParams.get('reference') ?? searchParams.get('trxref');
      if (!reference) { router.replace('/'); return; }
      toast.loading('Confirming payment…', { id: 'paystack-confirm' });
      confirmPaystackPayment({ reference })
        .then(() => {
          toast.success('Upgraded to Creator!', { id: 'paystack-confirm' });
        })
        .catch(() => {
          toast.error('Could not confirm payment. Contact support.', { id: 'paystack-confirm' });
        })
        .finally(() => router.replace('/'));
    }
  }, [searchParams, router, confirmPaystackPayment]);

  // Process recorded audio when recording stops
  useEffect(() => {
    if (recorder.state !== 'stopped' || !recorder.audioBlob) return;
    processAudio(recorder.audioBlob).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to process audio');
    });
  }, [recorder.state, recorder.audioBlob, processAudio]);

  const handleStartRecording = useCallback(async () => {
    transcription.clearTranscript();
    const stream = await recorder.startRecording();
    if (stream) analyser.connectStream(stream);
    setCurrentState('recording');
  }, [recorder, analyser, transcription, setCurrentState]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    analyser.disconnect();
  }, [recorder, analyser]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error('File too large. Maximum 50 MB.');
        return;
      }

      try {
        await processAudio(file);
      } catch {
        toast.error('Failed to load audio file. Try MP3, WAV, or M4A.');
      }

      if (e.target) e.target.value = '';
    },
    [processAudio]
  );

  const handleExport = useCallback(async () => {
    const gate = await exportGate.checkAndConsume();
    if (!gate.allowed) {
      setUpgradeTarget('export_limit');
      return;
    }

    const { audioBuffer } = useStore.getState();
    if (!audioBuffer) return;

    const canvas = document.createElement('canvas');
    const { width, height } = getCanvasDimensions(format);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await exporter.startExport(canvas, audioBuffer, tier === 'free');
  }, [format, exporter, exportGate, tier]);

  const handleDownload = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  const handleReset = useCallback(() => {
    recorder.resetRecording();
    transcription.clearTranscript();
    exporter.cancelExport();
    playback.stop();
    reset();
  }, [recorder, transcription, exporter, playback, reset]);

  return (
    <div className="min-h-dvh bg-black text-[#f8fafc] font-[family-name:var(--font-jakarta)]">
      {!capabilities.isLoading && <CapabilityBanner warnings={capabilities.warnings} />}

      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        {(currentState === 'recording' || currentState === 'export') && (
          <CaptionStyleSelector onLocked={setUpgradeTarget} />
        )}
        {!isSignedIn ? (
          <button
            onClick={() => openSignIn()}
            className="text-xs text-white/50 hover:text-white/80 transition-colors px-3 py-1.5
                       rounded-lg border border-white/10 hover:border-white/20"
          >
            Sign in
          </button>
        ) : (
          <UserButton />
        )}
      </div>

      <main
        id="main-content"
        className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
      >
        {currentState === 'idle' && (
          <>
            <IdleState
              onStartRecording={handleStartRecording}
              onFileUpload={handleFileUpload}
              canRecord={capabilities.canRecord}
              isLoading={capabilities.isLoading}
              waveformStyle={waveformStyle}
              fileInputRef={fileInputRef}
            />
            <div className="mt-6 w-full max-w-xs">
              <AudioSettings onLocked={setUpgradeTarget} />
            </div>
          </>
        )}

        {currentState === 'recording' && (
          <RecordingState
            onStopRecording={handleStopRecording}
            audioLevel={audioLevel}
            captionStyle={captionStyle}
            waveformStyle={waveformStyle}
            isSpeaking={audioLevel > 0.05}
          />
        )}

        {currentState === 'processing' && (
          <ProcessingState progress={processingProgress} />
        )}

        {currentState === 'export' && (
          <ExportState
            playback={playback}
            exporter={exporter}
            format={format}
            waveformStyle={waveformStyle}
            captionStyle={captionStyle}
            showWatermark={tier === 'free'}
            onExport={handleExport}
            onDownload={handleDownload}
            onReset={handleReset}
            onLocked={setUpgradeTarget}
          />
        )}

        {/* Phase transition announcer for screen readers */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {currentState === 'recording' && 'Recording started'}
          {currentState === 'processing' && 'Processing audio'}
          {currentState === 'export' && 'Export ready'}
        </div>
      </main>

      {(currentState === 'idle' || currentState === 'recording') && captionStyle !== 'karaoke' && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8">
          <WaveformStyleSelector onLocked={setUpgradeTarget} />
        </div>
      )}

      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
        onUpgrade={() => startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))}
      />

      <div
        className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 text-white/[0.08] text-[0.6875rem]
                   tracking-[0.2em] uppercase pointer-events-none select-none"
        aria-hidden="true"
      >
        ordio
      </div>
    </div>
  );
}
