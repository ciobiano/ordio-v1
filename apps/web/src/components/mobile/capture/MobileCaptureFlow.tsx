// Mobile/narrow-viewport chrome for the capture flow.
//
// Lifted verbatim out of app/create/page.tsx when that route became responsive.
// The extraction is what makes the switch safe: `useCreateFlow` starts a
// recorder, an analyser and a live-transcription session. If the route called it
// directly, both viewport branches' hooks would mount at once — two microphone
// streams competing for one device. Each chrome therefore owns its own hooks, and
// the route only chooses between components.
'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { useCreateFlow } from '@/hooks/recording/useCreateFlow';

const CaptureScreen = dynamic(
  () => import('@/components/mobile/capture/CaptureScreen').then((m) => ({ default: m.CaptureScreen })),
  { ssr: false }
);

const ProcessingAlertBanner = dynamic(
  () =>
    import('@/components/mobile/states/ProcessingAlertBanner').then(
      (m) => m.ProcessingAlertBanner
    ),
  { ssr: false }
);

const FileConfirmDialog = dynamic(
  () =>
    import('@/components/mobile/states/FileConfirmDialog').then(
      (m) => m.FileConfirmDialog
    ),
  { ssr: false }
);

const ClipPickerSheet = dynamic(
  () =>
    import('@/components/mobile/clips/ClipPickerSheet').then(
      (m) => m.ClipPickerSheet
    ),
  { ssr: false }
);

const EpisodeProgressOverlay = dynamic(
  () =>
    import('@/components/mobile/clips/EpisodeProgressOverlay').then(
      (m) => m.EpisodeProgressOverlay
    ),
  { ssr: false }
);

const EpisodeErrorDialog = dynamic(
  () =>
    import('@/components/mobile/clips/EpisodeErrorDialog').then(
      (m) => m.EpisodeErrorDialog
    ),
  { ssr: false }
);

export function MobileCaptureFlow() {
  const router = useRouter();
  const flow = useCreateFlow();

  return (
    <div className="relative min-h-dvh">
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
          error={flow.episode.error}
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
    </div>
  );
}
