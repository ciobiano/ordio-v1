'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useHaptics } from '@/hooks/useHaptics';
import { RecordingBottomBar } from './state/RecordingBottomBar';
import { RecordingCenterStatus } from './state/RecordingCenterStatus';
import { RecordingOverlayHeader } from './state/RecordingOverlayHeader';
import type { RecordingPhase, RecordingStateProps } from './state/types';
import { getOrbIntensity, getOrbState, getQualityBadge } from './state/utils';

const RecordingSettingsSheet = dynamic(
  () => import('./RecordingSettingsSheet').then((m) => ({ default: m.RecordingSettingsSheet })),
  { ssr: false }
);

export function RecordingState({
  audioLevel,
  isSpeaking,
  isPaused,
  recordingTime,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onRestart,
  onProceed,
  onCancel,
  onLocked,
}: RecordingStateProps) {
  const [phase, setPhase] = useState<RecordingPhase>('recording');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { trigger } = useHaptics();

  const qualityBadge = getQualityBadge(phase, isPaused, audioLevel, isSpeaking);
  const orbState = getOrbState(phase, isPaused, isSpeaking);
  const orbIntensity = getOrbIntensity(phase, isPaused, audioLevel);

  const handleStop = useCallback(() => {
    trigger('heavy');
    setPhase('stopped');
    onStopRecording();
  }, [onStopRecording, trigger]);

  const handleResume = useCallback(() => {
    trigger('medium');
    setPhase('recording');
    onResumeRecording();
  }, [onResumeRecording, trigger]);

  const handleRestart = useCallback(() => {
    trigger('medium');
    setPhase('recording');
    onRestart();
  }, [onRestart, trigger]);

  const handlePause = useCallback(() => {
    trigger('light');
    onPauseRecording();
  }, [onPauseRecording, trigger]);

  const handleProceed = useCallback(() => {
    trigger('success');
    onProceed();
  }, [onProceed, trigger]);

  const handleCancel = useCallback(() => {
    trigger('medium');
    onCancel();
  }, [onCancel, trigger]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 px-4 pb-4 pt-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <RecordingOverlayHeader onCancel={handleCancel} />

      <RecordingCenterStatus
        phase={phase}
        orbState={orbState}
        orbIntensity={orbIntensity}
        isSpeaking={isSpeaking}
        audioLevel={audioLevel}
        qualityBadge={qualityBadge}
        recordingTime={recordingTime}
      />

      <RecordingBottomBar
        phase={phase}
        isPaused={isPaused}
        recordingTime={recordingTime}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onRestart={handleRestart}
        onProceed={handleProceed}
        onCancel={handleCancel}
        onOpenSettings={() => {
          trigger('light');
          setSettingsOpen(true);
        }}
      />

      <RecordingSettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLocked={onLocked}
      />
    </motion.div>
  );
}

