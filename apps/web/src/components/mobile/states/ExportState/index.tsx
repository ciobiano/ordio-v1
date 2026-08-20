'use client';

import { useState, useCallback } from 'react';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import { useExportHistory } from '@/hooks/export/useExportHistory';
import { getCanvasDimensions, useCaptureStore, useProcessingStore, useUIStore } from '@/stores';
import { ExportHeader } from './ExportHeader';
import { ExportCanvas } from './ExportCanvas';
import { ExportControls } from './ExportControls';
import { ExportFooter } from './ExportFooter';
import { ExportOverlay } from './ExportOverlay';
import { ReframeSheet } from './ReframeSheet';
import { DiscardDialog } from './DiscardDialog';
import { TransportBar } from './transport/TransportBar';
import { DirectorSheet } from '@/components/mobile/captions/DirectorSheet';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';

interface UseVideoExporterShape {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (
    canvas: HTMLCanvasElement,
    audioBuffer: AudioBuffer,
    showWatermark?: boolean
  ) => Promise<void>;
  cancelExport: () => void;
}

interface ExportStateProps {
  playback: UsePlaybackReturn;
  exporter: UseVideoExporterShape;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  canvasLayout?: CanvasLayout;
  graphicStyle?: GraphicStyleId;
  showWatermark?: boolean;
  onExportStart: () => Promise<boolean>;
  onDownload: () => void;
  onReset: () => void;
  onLocked: (feature: FeatureKey) => void;
}

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  });
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  );
  return buf;
}

export default function ExportState({
  playback,
  exporter,
  format,
  waveformStyle,
  canvasLayout,
  graphicStyle,
  showWatermark = false,
  onExportStart,
  onDownload,
  onReset,
  onLocked,
}: ExportStateProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [exportOverlayOpen, setExportOverlayOpen] = useState(false);
  const [reframeOpen, setReframeOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  /** Owned here rather than inside ExportControls because the canvas above has
   *  to react to it: the stage shrinks, and its play badge steps out of the way. */
  const [panelOpen, setPanelOpen] = useState(false);
  const { isLocked } = useFeatureGates();

  /* The mix when a bed was placed on the desk, the bare voice otherwise.
     Export does not need to know a bed exists — it encodes whatever the
     capture store says the finished audio is. */
  const audioBuffer = useCaptureStore((s) => s.mixedBuffer ?? s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);
  const trimmer = useAudioTrimmer(playback.duration);
  const history = useExportHistory({ playback, trimmer });

  /**
   * Commit pending cuts — handles and selected silences — into a new buffer.
   *
   * The pre-cut buffer and transcript go onto the shared history first, so the
   * transport bar's undo walks back through this the same way it walks back
   * through a caption split.
   */
  const handleCommitTrim = useCallback(() => {
    if (!audioBuffer || !trimmer.hasChanges) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript ?? []);
    if ((trimmedChannels[0]?.length ?? 0) === 0) return;

    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript ?? []);

    history.pushTrim(audioBuffer, transcript ?? []);

    useCaptureStore.getState().setAudioBuffer(trimmedBuffer);
    useProcessingStore.getState().setTranscript(trimmedTranscript);
    playback.load(trimmedBuffer);
    trimmer.resetAll(trimmedBuffer.duration);
  }, [audioBuffer, transcript, trimmer, playback, history]);

  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return;

    // Video backgrounds preview free, but export is creator-gated
    const currentStyle = useUIStore.getState().style;
    if (currentStyle.background?.type === 'video' && isLocked('background_video')) {
      onLocked('background_video');
      return;
    }

    const allowed = await onExportStart();
    if (!allowed) return;

    setExportOverlayOpen(true);

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript);
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript);

    const { width, height } = getCanvasDimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = currentStyle.backgroundColor ?? '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    const originalTranscript = useProcessingStore.getState().transcript;
    useProcessingStore.setState({ transcript: trimmedTranscript });

    try {
      await exporter.startExport(canvas, trimmedBuffer, showWatermark);
    } finally {
      useProcessingStore.setState({ transcript: originalTranscript });
    }
  }, [
    audioBuffer,
    transcript,
    trimmer,
    format,
    exporter,
    showWatermark,
    onExportStart,
    isLocked,
    onLocked,
  ]);

  const exportDisabled = exporter.isExporting || trimmer.isEmpty;
  const hasRender = exporter.exportedUrl !== null && !exporter.isExporting;
  const primaryLabel = hasRender ? 'Save' : exporter.error ? 'Retry export' : 'Export';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden md:h-auto md:min-h-dvh md:overflow-visible animate-fadeIn">
      {/* Above the scroll region, so the bar stays put the way the dock does. */}
      <ExportHeader
        primaryLabel={primaryLabel}
        primaryDisabled={exportDisabled && !hasRender}
        onBack={() => setShowDiscardDialog(true)}
        onPrimary={hasRender ? () => setExportOverlayOpen(true) : handleExport}
      />

      {/* Nothing scrolls here on mobile — the stage flexes instead. Opening a
          panel shortens this row, which shrinks the canvas rather than pushing
          the transport off-screen. Panels do their own scrolling internally. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-start md:gap-6 md:px-6 md:py-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ExportCanvas
            playback={playback}
            format={format}
            waveformStyle={waveformStyle}
            canvasLayout={canvasLayout}
            graphicStyle={graphicStyle}
            showWatermark={showWatermark}
            onLocked={onLocked}
            stageShrunk={panelOpen}
          />

          <TransportBar
            playback={playback}
            history={history}
            onDirector={() => setDirectorOpen(true)}
          />

          <ExportFooter trimIsEmpty={trimmer.isEmpty} />
        </div>

        <ExportControls
          playback={playback}
          trimmer={trimmer}
          audioBuffer={audioBuffer}
          onLocked={onLocked}
          onCommit={handleCommitTrim}
          onOpenReframe={() => setReframeOpen(true)}
          reframeOpen={reframeOpen}
          drawerOpen={panelOpen}
          onDrawerOpenChange={setPanelOpen}
        />
      </div>

      <ExportOverlay
        open={exportOverlayOpen}
        exporter={exporter}
        transcript={transcript ?? []}
        durationSeconds={audioBuffer?.duration ?? 0}
        onDownload={onDownload}
        onClose={() => setExportOverlayOpen(false)}
      />

      <ReframeSheet
        open={reframeOpen}
        onClose={() => setReframeOpen(false)}
        onLocked={onLocked}
      />

      <DirectorSheet
        isOpen={directorOpen}
        onClose={() => setDirectorOpen(false)}
        onLocked={onLocked}
      />

      <DiscardDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={onReset}
      />
    </div>
  );
}
