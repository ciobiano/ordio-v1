'use client';

import { useState, useCallback } from 'react';
import { UserButton } from '@clerk/nextjs';
import CanvasPreview from '@/components/primitives/CanvasPreview';
import PlaybackControls from '@/components/primitives/PlaybackControls';
import { IconToolbar } from '@/components/primitives/IconToolbar';
import type { ToolbarPanel } from '@/components/primitives/IconToolbar';
import CaptionEditor from './CaptionEditor';
import StyleControls from './StyleControls';
import FormatToggle from './FormatToggle';
import { TrimPanel } from './TrimPanel';
import { useAudioTrimmer } from '@/hooks/useAudioTrimmer';
import { useStore, getCanvasDimensions } from '@/lib/store';
import { cn } from '@/lib/cn';
import { primaryBtn, panelCard } from '@/lib/variants';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';
import type { WaveformVariant, CaptionVariant, FormatVariant, GraphicStyleId } from '@/lib/store';
import type { FeatureKey } from '@/lib/featureGates';

interface UseVideoExporterShape {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>;
  cancelExport: () => void;
}

interface ExportStateProps {
  playback: UsePlaybackReturn;
  exporter: UseVideoExporterShape;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionStyle: CaptionVariant;
  graphicStyle?: GraphicStyleId;
  showWatermark?: boolean;
  onExportStart: () => Promise<boolean>;
  onDownload: () => void;
  onReset: () => void;
  onLocked: (feature: FeatureKey) => void;
}

const FORMAT_RATIO: Record<FormatVariant, string> = {
  square: '1:1',
  vertical: '9:16',
  horizontal: '16:9',
  instagram: '4:5',
};

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  });
  channels.forEach((ch, i) => buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i));
  return buf;
}

export default function ExportState({
  playback,
  exporter,
  format,
  waveformStyle,
  captionStyle,
  graphicStyle,
  showWatermark = false,
  onExportStart,
  onDownload,
  onReset,
  onLocked,
}: ExportStateProps) {
  const [activePanel, setActivePanel] = useState<ToolbarPanel>('captions');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const { audioBuffer, transcript } = useStore();
  const trimmer = useAudioTrimmer(playback.duration);

  const handlePlayToggle = useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else playback.play();
  }, [playback]);

  const handleBackClick = useCallback(() => {
    setShowDiscardDialog(true);
  }, []);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);
    onReset();
  }, [onReset]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

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
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    // Temporarily override transcript in store for the encoder, then restore.
    // The encoder reads transcript from the store internally.
    const store = useStore.getState();
    const originalTranscript = store.transcript;
    useStore.setState({ transcript: trimmedTranscript });

    try {
      await exporter.startExport(canvas, trimmedBuffer, showWatermark);
    } finally {
      useStore.setState({ transcript: originalTranscript });
    }
  }, [audioBuffer, transcript, trimmer, format, exporter, showWatermark, onExportStart]);

  const exportDisabled = exporter.isExporting || trimmer.isEmpty;

  const progressPct = Math.round(exporter.exportProgress);

  return (
    <div className="flex flex-col w-full min-h-dvh animate-fadeIn">
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <button
          type="button"
          onClick={handleBackClick}
          aria-label="Back — discard changes"
          className="w-10 h-10 flex items-center justify-center rounded-full
                     bg-[--surface] text-[--secondary] hover:bg-[--surface-hover]
                     hover:text-[--primary] transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
          </svg>
        </button>

        <span className="text-[--primary] text-sm font-medium tracking-tight">Edit</span>

        <div className="flex items-center gap-2">
          <UserButton />
          <button
            type="button"
            onClick={exporter.exportedUrl ? onDownload : handleExport}
            disabled={exportDisabled && !exporter.exportedUrl}
            aria-label={exporter.exportedUrl ? 'Download exported video' : 'Export video'}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-semibold tracking-tight transition-all duration-150',
              'bg-[--primary] text-black hover:opacity-90 active:scale-95',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100'
            )}
          >
            {exporter.exportedUrl ? 'Download' : 'Export'}
          </button>
        </div>
      </header>

      {/* Canvas preview with play overlay */}
      <div className="flex justify-center px-4 shrink-0">
        <div className="relative">
          <CanvasPreview
            playback={playback}
            format={format}
            waveformStyle={waveformStyle}
            captionStyle={captionStyle}
            graphicStyle={graphicStyle}
            showWatermark={showWatermark}
          />

          {/* Play / Pause overlay */}
          <button
            type="button"
            onClick={handlePlayToggle}
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
            disabled={playback.duration === 0}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'transition-opacity duration-150',
              playback.isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100',
              'disabled:cursor-not-allowed'
            )}
          >
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm
                            flex items-center justify-center
                            hover:bg-white/25 transition-colors duration-150">
              {playback.isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </button>

          {/* Format badge */}
          <span
            className="absolute top-2 right-2 text-[0.625rem] font-medium tracking-wider uppercase
                       text-white/50 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none"
            aria-hidden="true"
          >
            {FORMAT_RATIO[format]}
          </span>
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <PlaybackControls playback={playback} className="w-full" />
      </div>

      {/* Icon toolbar */}
      <div className="shrink-0 border-t border-[--border] mt-1">
        <IconToolbar activePanel={activePanel} onPanelChange={setActivePanel} />
      </div>

      {/* Active panel */}
      <div className={cn(panelCard, 'mx-4 mb-4 mt-2 px-4 py-4 shrink-0')}>
        {activePanel === 'captions' && (
          <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
        )}
        {activePanel === 'style' && (
          <StyleControls onLocked={onLocked} />
        )}
        {activePanel === 'format' && (
          <FormatToggle onLocked={onLocked} />
        )}
        {activePanel === 'trim' && (
          <TrimPanel
            audioBuffer={audioBuffer}
            transcript={transcript}
            trimmer={trimmer}
            onSeek={playback.seek}
          />
        )}
      </div>

      {/* Trim empty warning */}
      {trimmer.isEmpty && (
        <p role="alert" className="text-center text-sm text-destructive/70 px-4 pb-2 shrink-0">
          No audio remaining — adjust trim handles to continue
        </p>
      )}

      {/* Export progress bar */}
      {exporter.isExporting && (
        <div
          className="mx-4 mb-4 flex flex-col gap-2 shrink-0"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div className="w-full h-0.75 bg-[--surface] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[--primary] transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[--secondary] text-xs">
              Exporting&nbsp;{progressPct}%
            </span>
            <button
              type="button"
              onClick={exporter.cancelExport}
              aria-label="Cancel export"
              className="text-[--secondary] text-xs hover:text-[--primary] transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Export error */}
      {exporter.error && (
        <p role="alert" className="text-destructive text-sm text-center px-4 pb-3 shrink-0">
          {exporter.error}
        </p>
      )}

      {/* Download button after export */}
      {exporter.exportedUrl && (
        <div className="px-4 pb-6 shrink-0">
          <button onClick={onDownload} aria-label="Download exported video" className={primaryBtn}>
            Download
          </button>
        </div>
      )}

      {/* Discard confirmation dialog */}
      {showDiscardDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div className={cn(panelCard, 'w-full max-w-xs p-6 flex flex-col gap-4')}>
            <div className="flex flex-col gap-1.5">
              <h2 id="discard-dialog-title" className="text-[--primary] font-semibold text-base">
                Discard changes?
              </h2>
              <p className="text-[--secondary] text-sm">
                Your edits and recording will be lost. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleDiscardCancel}
                className="px-4 py-2 rounded-lg text-sm text-[--secondary] bg-[--surface]
                           hover:bg-[--surface-hover] transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white
                           bg-[rgba(225,29,72,0.8)] hover:bg-[rgba(225,29,72,0.95)]
                           transition-colors duration-150 cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
