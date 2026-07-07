// apps/web/src/app/create/page.tsx
// HIG-compliant: clarity, deference, depth, meaningful motion
// Pure composition — all logic lives in useCreateFlow
'use client';

import dynamic from 'next/dynamic';

import { useCreateFlow } from '@/hooks/recording/useCreateFlow';

const CaptureScreen = dynamic(
  () => import('@/components/soul/capture/CaptureScreen').then((m) => ({ default: m.CaptureScreen })),
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

export default function CreatePage() {
  const flow = useCreateFlow();

  return (
    <main id="main-content" className="relative min-h-dvh">
      <ProcessingAlertBanner
        alert={flow.processingAlert}
        onDisableEnhancement={flow.handleDisableEnhancement}
        onDismiss={flow.dismissAlert}
      />

      <CaptureScreen
        currentState={flow.currentState}
        audioLevel={flow.audioLevel}
        isSpeaking={flow.isSpeaking}
        isStarting={flow.isStarting}
        micDenied={flow.micDenied}
        canRecord={flow.capabilities.canRecord}
        recordingTime={flow.recorder.recordingTime}
        processingProgress={flow.processingProgress}
        fileInputRef={flow.fileInputRef}
        onFileUpload={flow.handleFileSelect}
        isPaused={flow.recorder.isPaused}
        onStartRecording={flow.handleStartRecording}
        onPauseRecording={flow.recorder.pauseRecording}
        onResumeRecording={flow.recorder.resumeRecording}
        onStopRecording={flow.handleStopRecording}
        onRestart={flow.handleRestart}
        onProceed={flow.handleProceed}
        onCancel={flow.handleReset}
        onLocked={flow.setUpgradeTarget}
      />

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
