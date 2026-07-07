'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import type { FeatureKey } from '@/lib/featureGates';
import { CaptureHeader } from './CaptureHeader';
import { CaptureStage } from './CaptureStage';
import { CaptureDock } from './CaptureDock';
import { UploadActionSheet } from './UploadActionSheet';
import { deriveCapturePhase } from './phase';
import type { RecordingSubPhase } from './types';

const RecordingSettingsSheet = dynamic(
  () => import('@/components/soul/recording/RecordingSettingsSheet').then((m) => ({ default: m.RecordingSettingsSheet })),
  { ssr: false }
);

const SavedAudioPanel = dynamic(() => import('@/components/saved-audio/SavedAudioPanel'), {
  ssr: false,
});

interface CaptureScreenProps {
  currentState: 'idle' | 'recording' | 'processing';
  audioLevel: number;
  isSpeaking: boolean;
  isStarting: boolean;
  micDenied: boolean;
  canRecord: boolean;
  processingProgress: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isPaused: boolean;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onRestart: () => void;
  onProceed: () => void;
  onCancel: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export function CaptureScreen({
  currentState,
  audioLevel,
  isSpeaking,
  isStarting,
  micDenied,
  canRecord,
  processingProgress,
  fileInputRef,
  onFileUpload,
  isPaused,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onRestart,
  onProceed,
  onCancel,
  onLocked,
}: CaptureScreenProps) {
  const [recordingSubPhase, setRecordingSubPhase] = useState<RecordingSubPhase>('recording');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const { trigger } = useHaptics();

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedFromHoldRef = useRef(false);

  const phase = deriveCapturePhase({ currentState, recordingSubPhase, isPaused });

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleIdleRecordPressStart = useCallback(() => {
    if (!canRecord || isStarting || micDenied) return;
    startedFromHoldRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      startedFromHoldRef.current = true;
      setRecordingSubPhase('recording');
      onStartRecording();
    }, 220);
  }, [canRecord, clearHoldTimer, isStarting, micDenied, onStartRecording]);

  const handleIdleRecordPressEnd = useCallback(() => {
    clearHoldTimer();
  }, [clearHoldTimer]);

  const handleIdleOrbClick = useCallback(() => {
    if (!canRecord || isStarting || micDenied) return;
    if (startedFromHoldRef.current) {
      startedFromHoldRef.current = false;
      return;
    }
    setRecordingSubPhase('recording');
    onStartRecording();
  }, [canRecord, isStarting, micDenied, onStartRecording]);

  const handleGoReady = useCallback(() => {
    trigger('heavy');
    setRecordingSubPhase('stopped');
    onStopRecording();
  }, [onStopRecording, trigger]);

  const handlePause = useCallback(() => {
    trigger('light');
    onPauseRecording();
  }, [onPauseRecording, trigger]);

  const handleResume = useCallback(() => {
    trigger('medium');
    onResumeRecording();
  }, [onResumeRecording, trigger]);

  const handleRestart = useCallback(() => {
    trigger('medium');
    setRecordingSubPhase('recording');
    onRestart();
  }, [onRestart, trigger]);

  const handleProcess = useCallback(() => {
    trigger('success');
    onProceed();
  }, [onProceed, trigger]);

  const handleCancel = useCallback(() => {
    trigger('medium');
    setRecordingSubPhase('recording');
    onCancel();
  }, [onCancel, trigger]);

  const handleBack = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  return (
    <div className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto bg-black text-white overflow-hidden select-none">
      <CaptureHeader phase={phase} onOpenFiles={() => setFilesOpen(true)} onBack={handleBack} />

      <CaptureStage
        phase={phase}
        audioLevel={audioLevel}
        isSpeaking={isSpeaking}
        onOrbClick={handleIdleOrbClick}
        onOrbPressStart={handleIdleRecordPressStart}
        onOrbPressEnd={handleIdleRecordPressEnd}
      />

      <CaptureDock
        phase={phase}
        progress={processingProgress}
        onOpenUpload={() => setUploadOpen(true)}
        onRecordPressStart={handleIdleRecordPressStart}
        onRecordPressEnd={handleIdleRecordPressEnd}
        onOpenSettings={() => setSettingsOpen(true)}
        onGoReady={handleGoReady}
        onProcess={handleProcess}
        onPause={handlePause}
        onResume={handleResume}
        onRestart={handleRestart}
        onCancel={handleCancel}
      />

      <UploadActionSheet isOpen={uploadOpen} onClose={() => setUploadOpen(false)} fileInputRef={fileInputRef} />

      <RecordingSettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onLocked={onLocked} />

      <SavedAudioPanel open={filesOpen} onOpenChange={setFilesOpen} hideTrigger />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4a"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  );
}
