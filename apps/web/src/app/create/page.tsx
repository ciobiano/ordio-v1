// apps/web/src/app/create/page.tsx
// HIG-compliant: clarity, deference, depth, meaningful motion
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import SavedAudioPanel from '@/components/saved-audio/SavedAudioPanel';
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
  loading: () => <div className="w-10 h-10 rounded-full bg-white/10" />,
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

// HIG: Quick, meaningful transitions — no decoration
const stateTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
};

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
      return;
    }
    const fallbackAlert: ProcessingAlertState = {
      stage: 'processing',
      title: 'Processing failed',
      detail: 'Processing stopped safely. You can retry from your previous screen.',
    };
    setProcessingAlert(fallbackAlert);
  }, []);

  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      setIsSpeaking(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
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
      setCurrentState('idle');
    }
  }, [recorder, handleStartRecording, setCurrentState]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setProcessingAlert(null);

      if (file.size > MAX_FILE_SIZE_BYTES) {
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
  }, [setEnhanceTier]);

  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 pb-28 pt-6 safe-pb safe-pt"
    >
      <SavedAudioPanel />

      {/* HIG: Alerts as overlays that don't destroy context */}
      <AnimatePresence>
        {processingAlert && (
          <motion.div
            className="fixed top-4 left-1/2 z-50 w-[min(92vw,42rem)] -translate-x-1/2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIG: Avatar button positioned with deference — doesn't block content */}
      {currentState === 'idle' && (
        <div className="fixed right-4 top-4 z-20 safe-pt">
          <UserAvatarButton />
        </div>
      )}

      {/* HIG: State transitions — meaningful motion only */}
      <AnimatePresence mode="wait">
        {currentState === 'idle' && (
          <motion.div
            key="idle"
            className="w-full max-w-md"
            {...stateTransition}
          >
            <IdleState
              onStartRecording={handleStartRecording}
              onFileUpload={handleFileUpload}
              canRecord={capabilities.canRecord}
              isLoading={isStarting}
              micDenied={micDenied}
              fileInputRef={fileInputRef}
            />
          </motion.div>
        )}

        {currentState === 'recording' && (
          <motion.div
            key="recording"
            className="w-full"
            {...stateTransition}
          >
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
          </motion.div>
        )}

        {currentState === 'processing' && (
          <motion.div
            key="processing"
            className="w-full"
            {...stateTransition}
          >
            <ProcessingState progress={processingProgress} onCancel={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIG: Live region for screen readers — invisible but announced */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentState === 'recording' && 'Recording started'}
        {currentState === 'processing' && 'Processing audio'}
      </div>
    </main>
  );
}
