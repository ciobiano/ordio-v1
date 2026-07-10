// apps/web/src/components/soul/export/ExportScreen.tsx
'use client';

import { useCallback, useState } from 'react';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import { getCanvasDimensions, useCaptureStore, useProcessingStore, useUIStore } from '@/stores';
import { ExportHeader } from './ExportHeader';
import { ExportStage } from './ExportStage';
import { ExportDock } from './ExportDock';
import { StyleSheet } from './StyleSheet';
import { EditSheet } from './EditSheet';
import { ShareTakeover } from './ShareTakeover';
import { DiscardDialog } from './DiscardDialog';
import { useTrimHistory } from './useTrimHistory';
import { deriveExportPhase } from './phase';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import type { Word } from '@Ordio/shared/schemas';

interface UseVideoExporterShape {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}

interface ExportScreenProps {
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
  const buf = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0]?.length ?? 0, sampleRate });
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  );
  return buf;
}

function headlineFromTranscript(transcript: Word[] | undefined): string {
  if (!transcript || transcript.length === 0) return 'Say it out loud.';
  return transcript.slice(0, 8).map((w) => w.text).join(' ').trim();
}

export default function ExportScreen({
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
}: ExportScreenProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const transcript = useProcessingStore((s) => s.transcript);
  const trimmer = useAudioTrimmer(playback.duration);
  const history = useTrimHistory({ playback, trimmer });

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
  const phase = deriveExportPhase({
    isExporting: exporter.isExporting,
    exportedUrl: exporter.exportedUrl,
    error: exporter.error,
  });

  return (
    <div className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto overflow-hidden select-none bg-black text-white">
      <ExportHeader phase={phase} onBack={() => setShowDiscardDialog(true)} />

      <ExportStage
        playback={playback}
        format={format}
        waveformStyle={waveformStyle}
        captionMode={captionMode}
        canvasLayout={canvasLayout}
        graphicStyle={graphicStyle}
        showWatermark={showWatermark}
      />

      <ShareTakeover
        isVisible={phase === 'done'}
        headline={headlineFromTranscript(transcript ?? undefined)}
        durationSeconds={audioBuffer?.duration ?? 0}
      />

      <ExportDock
        phase={phase}
        progress={exporter.exportProgress}
        exportDisabled={exportDisabled}
        onOpenStyle={() => setStyleOpen(true)}
        onOpenEdit={() => setEditOpen(true)}
        onExport={handleExport}
        onDownload={onDownload}
        onCancelExport={exporter.cancelExport}
        onReset={onReset}
      />

      <StyleSheet isOpen={styleOpen} onClose={() => setStyleOpen(false)} onLocked={onLocked} />
      <EditSheet
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        playback={playback}
        trimmer={trimmer}
        audioBuffer={audioBuffer}
        history={history}
        onLocked={onLocked}
      />

      <DiscardDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog} onConfirm={onReset} />
    </div>
  );
}
