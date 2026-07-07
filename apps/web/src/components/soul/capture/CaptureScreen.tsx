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

  const pressActiveRef = useRef(false);
  const pressStartRef = useRef(0);

  const phase = deriveCapturePhase({ currentState, recordingSubPhase, isPaused });

  // Matches the mockup's onPrimaryDown/finishPress model: pressing down starts recording
  // immediately (no artificial hold delay — a plain tap must work), and a long hold that's
  // still active on release auto-advances straight to 'ready', as a quick-finish shortcut.
  const handlePrimaryDown = useCallback(() => {
    if (!canRecord || isStarting || micDenied || phase !== 'idle') return;
    pressActiveRef.current = true;
    pressStartRef.current = Date.now();
    setRecordingSubPhase('recording');
    onStartRecording();
  }, [canRecord, isStarting, micDenied, phase, onStartRecording]);

  const handleGoReady = useCallback(() => {
    trigger('heavy');
    setRecordingSubPhase('stopped');
    onStopRecording();
  }, [onStopRecording, trigger]);

  // A press started from idle that's still held past this threshold on release auto-advances
  // to 'ready' — a quick-finish shortcut. A plain tap just leaves the recording running.
  const PRESS_AUTO_FINISH_MS = 350;
  const finishPress = useCallback(() => {
    if (!pressActiveRef.current) return;
    pressActiveRef.current = false;
    const held = Date.now() - pressStartRef.current;
    if (held > PRESS_AUTO_FINISH_MS) handleGoReady();
  }, [handleGoReady]);

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
        // Orb only wires up pointer handlers when onClick is present (see Orb.tsx) — the click
        // itself is a no-op here since pointerdown/pointerup already handle start/finish.
        onOrbClick={() => {}}
        onOrbPressStart={handlePrimaryDown}
        onOrbPressEnd={finishPress}
      />

      <CaptureDock
        phase={phase}
        progress={processingProgress}
        onOpenUpload={() => setUploadOpen(true)}
        onRecordPressStart={handlePrimaryDown}
        onRecordPressEnd={finishPress}
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
