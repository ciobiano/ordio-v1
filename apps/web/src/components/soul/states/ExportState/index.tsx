'use client';

import { useState, useCallback } from 'react';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import { getCanvasDimensions, useCaptureStore, useProcessingStore, useUIStore } from '@/stores';
import { ExportHeader } from './ExportHeader';
import { ExportCanvas } from './ExportCanvas';
import { ExportControls } from './ExportControls';
import { ExportFooter } from './ExportFooter';
import { DiscardDialog } from './DiscardDialog';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type {
  WaveformVariant,
  CaptionMode,
  CanvasLayout,
  FormatVariant,
  GraphicStyleId,
} from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import type { Word } from '@Ordio/shared/schemas';

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
  captionMode: CaptionMode;
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
  captionMode,
  canvasLayout,
  graphicStyle,
  showWatermark = false,
  onExportStart,
  onDownload,
  onReset,
  onLocked,
}: ExportStateProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  type TrimSnapshot = { audioBuffer: AudioBuffer; transcript: Word[] };
  const MAX_HISTORY = 5;
  const [past, setPast] = useState<TrimSnapshot[]>([]);
  const [future, setFuture] = useState<TrimSnapshot[]>([]);

  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);
  const trimmer = useAudioTrimmer(playback.duration);

  const restoreSnapshot = useCallback(
    (snap: TrimSnapshot) => {
      useCaptureStore.getState().setAudioBuffer(snap.audioBuffer);
      useProcessingStore.getState().setTranscript(snap.transcript);
      playback.load(snap.audioBuffer);
      trimmer.resetAll(snap.audioBuffer.duration);
    },
    [playback, trimmer]
  );

  // Commit all pending cuts (handles + silences) into a new AudioBuffer.
  // Pushes current state to past, clears future (new branch).
  const handleCommitTrim = useCallback(() => {
    if (!audioBuffer || !trimmer.hasChanges) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript ?? []);
    if ((trimmedChannels[0]?.length ?? 0) === 0) return;
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript ?? []);

    setPast((prev) => [
      ...prev.slice(-(MAX_HISTORY - 1)),
      { audioBuffer, transcript: transcript ?? [] },
    ]);
    setFuture([]);

    useCaptureStore.getState().setAudioBuffer(trimmedBuffer);
    useProcessingStore.getState().setTranscript(trimmedTranscript);
    playback.load(trimmedBuffer);
    trimmer.resetAll(trimmedBuffer.duration);
  }, [audioBuffer, transcript, trimmer, playback]);

  const handleUndoTrim = useCallback(() => {
    if (past.length === 0 || !audioBuffer) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [
      { audioBuffer, transcript: transcript ?? [] },
      ...f.slice(0, MAX_HISTORY - 1),
    ]);
    restoreSnapshot(prev);
  }, [past, future, audioBuffer, transcript, restoreSnapshot]);

  const handleRedoTrim = useCallback(() => {
    if (future.length === 0 || !audioBuffer) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), { audioBuffer, transcript: transcript ?? [] }]);
    restoreSnapshot(next);
  }, [past, future, audioBuffer, transcript, restoreSnapshot]);

  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return;

    const allowed = await onExportStart();
    if (!allowed) return;

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript);
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate);
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript);

    const { width, height } = getCanvasDimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const style = useUIStore.getState().style;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = style.backgroundColor ?? '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    const originalTranscript = useProcessingStore.getState().transcript;
    useProcessingStore.setState({ transcript: trimmedTranscript });

    try {
      await exporter.startExport(canvas, trimmedBuffer, showWatermark);
    } finally {
      useProcessingStore.setState({ transcript: originalTranscript });
    }
  }, [audioBuffer, transcript, trimmer, format, exporter, showWatermark, onExportStart]);

  const exportDisabled = exporter.isExporting || trimmer.isEmpty;

  return (
    <div className="flex flex-col w-full  min-h-dvh animate-fadeIn">
      <ExportHeader
        exportedUrl={exporter.exportedUrl}
        exportDisabled={exportDisabled}
        onBack={() => setShowDiscardDialog(true)}
        onExport={handleExport}
        onDownload={onDownload}
      />

        <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:gap-6 md:px-6">
        <ExportCanvas
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          captionMode={captionMode}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
          onLocked={onLocked}
        />

        <ExportControls
          playback={playback}
          trimmer={trimmer}
          audioBuffer={audioBuffer}
          transcript={transcript ?? []}
          onLocked={onLocked}
          onCommit={handleCommitTrim}
          onUndo={handleUndoTrim}
          onRedo={handleRedoTrim}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
        />
      </div>

      <ExportFooter
        trimIsEmpty={trimmer.isEmpty}
        exporter={exporter}
        onDownload={onDownload}
        transcript={transcript ?? []}
        durationSeconds={audioBuffer?.duration ?? 0}
      />

      <DiscardDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={onReset}
      />
    </div>
  );
}
