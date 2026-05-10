// apps/web/src/app/create/page.tsx
// HIG-compliant: clarity, deference, depth, meaningful motion
// Pure composition — all logic lives in useCreateFlow
'use client';

import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

import { useCreateFlow } from '@/hooks/recording/useCreateFlow';

const IdleState = dynamic(() => import('@/components/soul/states/IdleState'), {
  ssr: false,
});

const SavedAudioPanel = dynamic(
  () => import('@/components/saved-audio/SavedAudioPanel'),
  { ssr: false }
);

const ProcessingAlertBanner = dynamic(
  () =>
    import('@/components/soul/states/ProcessingAlertBanner').then(
      (m) => m.ProcessingAlertBanner
    ),
  { ssr: false }
);

const FileConfirmDialog = dynamic(
  () =>
    import('@/components/soul/states/FileConfirmDialog').then(
      (m) => m.FileConfirmDialog
    ),
  { ssr: false }
);

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

// HIG: Quick, meaningful transitions — no decoration
const stateTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
};

export default function CreatePage() {
  const flow = useCreateFlow();

  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 pb-28 pt-6 safe-pb safe-pt"
    >
      <SavedAudioPanel />

      <ProcessingAlertBanner
        alert={flow.processingAlert}
        onDisableEnhancement={flow.handleDisableEnhancement}
        onDismiss={flow.dismissAlert}
      />

      {/* HIG: Avatar button positioned with deference — doesn't block content */}
      {flow.currentState === 'idle' && (
        <div className="fixed right-4 top-4 z-20 safe-pt">
          <UserAvatarButton />
        </div>
      )}

      {/* HIG: State transitions — meaningful motion only */}
      <AnimatePresence mode="wait">
        {flow.currentState === 'idle' && (
          <motion.div key="idle" className="w-full max-w-md" {...stateTransition}>
            <IdleState
              onStartRecording={flow.handleStartRecording}
              onFileUpload={flow.handleFileSelect}
              canRecord={flow.capabilities.canRecord}
              isLoading={flow.isStarting}
              micDenied={flow.micDenied}
              fileInputRef={flow.fileInputRef}
            />
          </motion.div>
        )}

        {flow.currentState === 'recording' && (
          <motion.div key="recording" className="w-full" {...stateTransition}>
            <RecordingState
              audioLevel={flow.audioLevel}
              isSpeaking={flow.isSpeaking}
              isPaused={flow.recorder.isPaused}
              recordingTime={flow.recorder.recordingTime}
              onPauseRecording={flow.recorder.pauseRecording}
              onResumeRecording={flow.recorder.resumeRecording}
              onStopRecording={flow.handleStopRecording}
              onRestart={flow.handleRestart}
              onProceed={flow.handleProceed}
              onCancel={flow.handleReset}
              onLocked={flow.setUpgradeTarget}
            />
          </motion.div>
        )}

        {flow.currentState === 'processing' && (
          <motion.div key="processing" className="w-full" {...stateTransition}>
            <ProcessingState progress={flow.processingProgress} onCancel={flow.handleReset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIG: File upload confirmation — user confirms before processing */}
      <FileConfirmDialog
        file={flow.stagedFile}
        onConfirm={flow.handleFileConfirm}
        onCancel={() => flow.setStagedFile(null)}
      />

      {/* HIG: Live region for screen readers — invisible but announced */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {flow.currentState === 'recording' && 'Recording started'}
        {flow.currentState === 'processing' && 'Processing audio'}
      </div>
    </main>
  );
}
