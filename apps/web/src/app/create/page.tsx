// apps/web/src/app/create/page.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useUIStore, useCaptureStore, useProcessingStore } from '@/stores';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/audio/useAudioAnalyser';
import { useTranscription } from '@/hooks/recording/useTranscription';
import { useAudioProcessing } from '@/hooks/audio/useAudioProcessing';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useVAD } from '@/hooks/recording/useVAD';

import IdleState from '@/components/soul/states/IdleState';
import { Skeleton } from '@/components/ui/skeleton';

const RecordingState = dynamic(
  () =>
    import('@/components/soul/recording/RecordingState').then((m) => ({
      default: m.RecordingState,
    })),
  { ssr: false }
);

const ProcessingState = dynamic(() => import('@/components/soul/states/ProcessingState'), {
  ssr: false,
});

const UserAvatarButton = dynamic(() => import('@/components/soul/auth/UserAvatarButton'), {
  ssr: false,
  loading: () => <Skeleton variant="avatar" size="lg" animation="shimmer" />,
});

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function CreatePage() {
  const router = useRouter();
  const { currentState, setCurrentState, setUpgradeTarget } = useUIStore();
  const resetUI = useUIStore((s) => s.resetUI);
  const resetCapture = useCaptureStore((s) => s.resetCapture);
  const resetProcessing = useProcessingStore((s) => s.resetProcessing);

  const reset = useCallback(() => {
    resetCapture();
    resetProcessing();
    resetUI();
  }, [resetCapture, resetProcessing, resetUI]);

  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio, cancelProcessing } = useAudioProcessing(transcription);
  const { tier } = useCurrentUser();
  const capabilities = useCapabilities();
  const vad = useVAD(recorder.isRecording);

  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      setIsSpeaking(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    // Sync VAD state to React state for passing to components
    setIsSpeaking(vad.isSpeaking);
  }, [recorder.isRecording, vad.isSpeaking]);

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

  const handleStartRecording = useCallback(async () => {
    setIsStarting(true);
    transcription.clearTranscript();
    try {
      const stream = await recorder.startRecording();
      if (!stream) {
        const isDenied =
          recorder.error?.toLowerCase().includes('denied') ||
          recorder.error?.toLowerCase().includes('permission');
        if (isDenied) {
          setMicDenied(true);
        } else {
          toast.error(
            recorder.error ?? 'Microphone access denied. Check your browser permissions.'
          );
        }
        return;
      }
      setMicDenied(false);
      analyser.connectStream(stream);
      setCurrentState('recording');
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription, setCurrentState]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    analyser.disconnect();
  }, [recorder, analyser]);

  const handleProceed = useCallback(async () => {
    if (!recorder.audioBlob) return;
    try {
      const sessionId = await processAudio(recorder.audioBlob);
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Processing failed');
    }
  }, [recorder.audioBlob, processAudio, router]);

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
        const sessionId = await processAudio(file);
        router.push(`/create/export/${sessionId}`);
      } catch {
        toast.error('Could not read this file. Try M4A, MP3, WAV, MOV, MP4, or MKV.');
      }

      if (e.target) e.target.value = '';
    },
    [processAudio, router]
  );

  const handleReset = useCallback(() => {
    cancelProcessing();
    recorder.resetRecording();
    transcription.clearTranscript();
    reset();
  }, [cancelProcessing, recorder, transcription, reset]);

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
    >
      {currentState === 'idle' && (
        <div className="fixed top-4 right-4 z-20">
          <UserAvatarButton />
        </div>
      )}

      {currentState === 'idle' && (
        <IdleState
          onStartRecording={handleStartRecording}
          onFileUpload={handleFileUpload}
          canRecord={capabilities.canRecord}
          isLoading={isStarting}
          micDenied={micDenied}
          fileInputRef={fileInputRef}
        />
      )}

      {currentState === 'recording' && (
        <RecordingState
          audioLevel={audioLevel}
          isSpeaking={isSpeaking}
          isPaused={recorder.isPaused}
          recordingTime={recorder.recordingTime}
          onPauseRecording={recorder.pauseRecording}
          onResumeRecording={recorder.resumeRecording}
          onStopRecording={handleStopRecording}
          onRestart={handleRestart}
          onProceed={handleProceed}
          onCancel={handleReset}
          onLocked={setUpgradeTarget}
        />
      )}

      {currentState === 'processing' && (
        <ProcessingState progress={processingProgress} onCancel={handleReset} />
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentState === 'recording' && 'Recording started'}
        {currentState === 'processing' && 'Processing audio'}
      </div>
    </main>
  );
}
