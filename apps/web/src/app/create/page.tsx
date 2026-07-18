// apps/web/src/app/create/page.tsx
// HIG-compliant: clarity, deference, depth, meaningful motion
// Pure composition — all logic lives in useCreateFlow
'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

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

const ClipPickerSheet = dynamic(
  () =>
    import('@/components/soul/clips/ClipPickerSheet').then(
      (m) => m.ClipPickerSheet
    ),
  { ssr: false }
);

const EpisodeProgressOverlay = dynamic(
  () =>
    import('@/components/soul/clips/EpisodeProgressOverlay').then(
      (m) => m.EpisodeProgressOverlay
    ),
  { ssr: false }
);

const EpisodeErrorDialog = dynamic(
  () =>
    import('@/components/soul/clips/EpisodeErrorDialog').then(
      (m) => m.EpisodeErrorDialog
    ),
  { ssr: false }
);

export default function CreatePage() {
  const router = useRouter();
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
        processingProgress={flow.processingProgress}
        fileInputRef={flow.fileInputRef}
        onFileUpload={flow.handleFileSelect}
        isPaused={flow.recorder.isPaused}
        committedCaptionLines={flow.committedCaptionLines}
        interimCaptionText={flow.interimCaptionText}
        onStartRecording={flow.handleStartRecording}
        onPauseRecording={flow.handlePauseRecording}
        onResumeRecording={flow.handleResumeRecording}
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

      {/* Long-episode clip-finder pipeline — routes files over the duration
          threshold away from the short staged-file confirm flow above. */}
      <ClipPickerSheet
        isOpen={flow.episode.phase === 'picking'}
        candidates={flow.episode.candidates}
        episodeFile={flow.episode.episodeFile}
        episodeWords={flow.episode.episodeWords}
        onClose={flow.episode.cancel}
        onPicked={(sessionId) => {
          flow.episode.cancel();
          router.push(`/create/export/${sessionId}`);
        }}
      />
      {(flow.episode.phase === 'ingesting' ||
        flow.episode.phase === 'transcribing' ||
        flow.episode.phase === 'finding') && (
        <EpisodeProgressOverlay
          phase={flow.episode.phase}
          progress={flow.episode.progress}
          onCancel={flow.episode.cancel}
        />
      )}
      {flow.episode.phase === 'error' && (
        <EpisodeErrorDialog
          message={flow.episode.error ?? 'Something went wrong.'}
          partialAvailable={flow.episode.partialAvailable}
          onUsePartial={flow.episode.usePartialTranscript}
          onDismiss={flow.episode.cancel}
        />
      )}

      {/* HIG: Live region for screen readers — invisible but announced */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {flow.currentState === 'recording' && 'Recording started'}
        {flow.currentState === 'processing' && 'Processing audio'}
      </div>
    </main>
  );
}
