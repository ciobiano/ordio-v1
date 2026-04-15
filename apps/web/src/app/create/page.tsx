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
import {
  AudioProcessingError,
  type AudioProcessingFailureStage,
  useAudioProcessing,
} from '@/hooks/audio/useAudioProcessing';
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useVAD } from '@/hooks/recording/useVAD';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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

interface ProcessingAlertState {
  stage: AudioProcessingFailureStage;
  title: string;
  detail: string;
}

function buildProcessingAlert(error: AudioProcessingError): ProcessingAlertState {
  if (error.stage === 'enhancement') {
    return {
      stage: error.stage,
      title: 'Enhancement failed',
      detail:
        'Processing stopped before transcription. For faster recovery and lower additional AI usage, turn enhancement off and retry.',
    };
  }

  if (error.stage === 'transcription') {
    return {
      stage: error.stage,
      title: 'Transcription failed',
      detail:
        'Processing stopped and you were returned to your previous screen. Review your recording or upload and retry when ready.',
    };
  }

  return {
    stage: error.stage,
    title: 'Processing failed',
    detail: 'Processing stopped safely. You can adjust settings and retry from this screen.',
  };
}

export default function CreatePage() {
  const router = useRouter();
  const { currentState, setCurrentState, setUpgradeTarget } = useUIStore();
  const resetUI = useUIStore((s) => s.resetUI);
  const resetCapture = useCaptureStore((s) => s.resetCapture);
  const resetProcessing = useProcessingStore((s) => s.resetProcessing);
  const setEnhanceTier = useProcessingStore((s) => s.setEnhanceTier);

  const reset = useCallback(() => {
    resetCapture();
    resetProcessing();
    resetUI();
  }, [resetCapture, resetProcessing, resetUI]);

  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [processingAlert, setProcessingAlert] = useState<ProcessingAlertState | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio, cancelProcessing } = useAudioProcessing(transcription);
  const capabilities = useCapabilities();
  const vad = useVAD(recorder.isRecording);

  const handleProcessingFailure = useCallback((err: unknown) => {
    if (err instanceof AudioProcessingError) {
      const alert = buildProcessingAlert(err);
      setProcessingAlert(alert);
      toast.error(alert.title);
      return;
    }
    const fallbackAlert: ProcessingAlertState = {
      stage: 'processing',
      title: 'Processing failed',
      detail: 'Processing stopped safely. You can retry from your previous screen.',
    };
    setProcessingAlert(fallbackAlert);
    toast.error(fallbackAlert.title);
  }, []);

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
    setProcessingAlert(null);
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
    setProcessingAlert(null);
    try {
      const sessionId = await processAudio(recorder.audioBlob);
      if (!sessionId) return;
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [recorder.audioBlob, processAudio, router, handleProcessingFailure]);

  const handleRestart = useCallback(async () => {
    setProcessingAlert(null);
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
      setProcessingAlert(null);

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error('File too large. Maximum 50 MB.');
        return;
      }

      try {
        const sessionId = await processAudio(file);
        if (!sessionId) return;
        router.push(`/create/export/${sessionId}`);
      } catch (err) {
        handleProcessingFailure(err);
      }

      if (e.target) e.target.value = '';
    },
    [processAudio, router, handleProcessingFailure]
  );

  const handleReset = useCallback(() => {
    cancelProcessing();
    recorder.resetRecording();
    transcription.clearTranscript();
    setProcessingAlert(null);
    reset();
  }, [cancelProcessing, recorder, transcription, reset]);

  const handleDisableEnhancement = useCallback(() => {
    setEnhanceTier('none');
    setProcessingAlert(null);
    toast.success('Enhancement disabled. Retry when ready.');
  }, [setEnhanceTier]);

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
    >
      {processingAlert && (
        <div className="fixed top-4 left-1/2 z-30 w-[min(92vw,42rem)] -translate-x-1/2">
          <Alert
            variant="destructive"
            className="border border-red-400/40 bg-red-950/90 text-red-50 shadow-lg backdrop-blur-sm"
          >
            <AlertTitle className="text-red-50">{processingAlert.title}</AlertTitle>
            <AlertDescription className="text-red-100/90 leading-relaxed">
              {processingAlert.detail}
            </AlertDescription>
            <div className="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
              {processingAlert.stage === 'enhancement' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDisableEnhancement}
                  className="border-red-300/40 bg-transparent text-red-50 hover:bg-red-900/60 hover:text-white"
                >
                  Turn enhancement off
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setProcessingAlert(null)}
                className="text-red-100 hover:bg-red-900/60 hover:text-white"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        </div>
      )}
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
