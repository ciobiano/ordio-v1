// apps/web/src/app/create/page.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useTranscription } from '@/hooks/useTranscription';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCapabilities } from '@/hooks/useCapabilities';

import {
  IdleState,
  RecordingState,
  ProcessingState,
} from '@/components/soul';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function CreatePage() {
  const router = useRouter();
  const {
    currentState,
    setCurrentState,
    setUpgradeTarget,
    reset,
  } = useStore();

  const [audioLevel, setAudioLevel] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);
  const { tier } = useCurrentUser();
  const capabilities = useCapabilities();

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

  const handleStartRecording = useCallback(async () => {
    transcription.clearTranscript();
    const stream = await recorder.startRecording();
    if (!stream) {
      toast.error(recorder.error ?? 'Microphone access denied. Check your browser permissions.');
      return;
    }
    analyser.connectStream(stream);
    setCurrentState('recording');
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
        toast.error('Failed to load audio file. Try MP3, WAV, or M4A.');
      }

      if (e.target) e.target.value = '';
    },
    [processAudio, router]
  );

  const handleReset = useCallback(() => {
    recorder.resetRecording();
    transcription.clearTranscript();
    reset();
  }, [recorder, transcription, reset]);

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
    >
      {currentState === 'idle' && (
        <div className="fixed top-4 right-4 z-20">
          <UserButton />
        </div>
      )}

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
