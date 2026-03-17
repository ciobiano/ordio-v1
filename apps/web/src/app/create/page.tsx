'use client';

import { Suspense, useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useStore } from '@/lib/store';
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
import { usePaymentRedirect } from '@/hooks/usePaymentRedirect';
import type { FeatureKey } from '@/lib/featureGates';

import { CapabilityBanner } from '@/components/primitives';
import {
  AuthGate,
  IdleState,
  RecordingState,
  ProcessingState,
  ExportState,
  UpgradeSheet,
} from '@/components/soul';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function CreatePage() {
  return (
    <Suspense>
      <CreateContent />
    </Suspense>
  );
}

function CreateContent() {
  const {
    currentState,
    waveformStyle,
    captionStyle,
    graphicStyle,
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
  const { tier, isLoading } = useCurrentUser();
  const exportGate = useExportGate();
  const { isSignedIn } = useAuth();
  const { startCheckout } = useCheckout();
  usePaymentRedirect();

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

  const handleProceed = useCallback(() => {
    if (!recorder.audioBlob) return;
    processAudio(recorder.audioBlob).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Processing failed');
    });
  }, [recorder.audioBlob, processAudio]);

  const handleRestart = useCallback(async () => {
    recorder.resetRecording();
    try {
      await handleStartRecording();
    } catch {
      toast.error('Failed to restart recording');
      setCurrentState('idle');
    }
  }, [recorder, handleStartRecording, setCurrentState]);

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

  const handleExportStart = useCallback(async (): Promise<boolean> => {
    const gate = await exportGate.checkAndConsume();
    if (!gate.allowed) {
      setUpgradeTarget('export_limit');
      return false;
    }
    return true;
  }, [exportGate]);

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

  if (!isSignedIn && !isLoading) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-dvh bg-black text-[--primary] font-[family-name:var(--font-jakarta)]">
      {!capabilities.isLoading && <CapabilityBanner warnings={capabilities.warnings} />}

      {(currentState === 'idle' || currentState === 'export') && (
        <div className="fixed top-4 right-4 z-20">
          <UserButton />
        </div>
      )}

      <main
        id="main-content"
        className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
      >
        {currentState === 'idle' && (
          <IdleState
            onStartRecording={handleStartRecording}
            onFileUpload={handleFileUpload}
            canRecord={capabilities.canRecord}
            isLoading={false}
            fileInputRef={fileInputRef}
          />
        )}

        {currentState === 'recording' && (
          <RecordingState
            audioLevel={audioLevel}
            isPaused={recorder.isPaused}
            recordingTime={recorder.recordingTime}
            onPauseRecording={recorder.pauseRecording}
            onResumeRecording={recorder.resumeRecording}
            onStopRecording={handleStopRecording}
            onRestart={handleRestart}
            onProceed={handleProceed}
            onLocked={setUpgradeTarget}
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
            graphicStyle={graphicStyle}
            showWatermark={tier === 'free'}
            onExportStart={handleExportStart}
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

      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
        onUpgrade={() => startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))}
      />

      <div
        className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 text-white/8 text-[length:var(--text-footnote)]
                   tracking-[0.2em] uppercase pointer-events-none select-none"
        aria-hidden="true"
      >
        ordio
      </div>
    </div>
  );
}
