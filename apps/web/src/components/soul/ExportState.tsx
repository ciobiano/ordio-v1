'use client';

import CanvasPreview from '@/components/primitives/CanvasPreview';
import PlaybackControls from '@/components/primitives/PlaybackControls';
import CaptionEditor from './CaptionEditor';
import StyleControls from './StyleControls';
import FormatToggle from './FormatToggle';
import { primaryBtn, ghostBtn } from '@/lib/variants';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';
import type { WaveformVariant, CaptionVariant, FormatVariant, GraphicStyleId } from '@/lib/store';
import type { FeatureKey } from '@/lib/featureGates';

interface UseVideoExporterShape {
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;
  exportMimeType: string | null;
  error: string | null;
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
  onExport: () => void;
  onDownload: () => void;
  onReset: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export default function ExportState({
  playback,
  exporter,
  format,
  waveformStyle,
  captionStyle,
  graphicStyle,
  showWatermark = false,
  onExport,
  onDownload,
  onReset,
  onLocked,
}: ExportStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 animate-fadeIn w-full max-w-sm">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full bg-green-500/12 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            className="w-4.5 h-4.5 text-green-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-[1.375rem] font-light tracking-[-0.02em]">Ready to share</h2>
      </div>

      <CanvasPreview
        playback={playback}
        format={format}
        waveformStyle={waveformStyle}
        captionStyle={captionStyle}
        graphicStyle={graphicStyle}
        showWatermark={showWatermark}
      />

      <PlaybackControls playback={playback} className="w-full" />

      <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />

      <StyleControls onLocked={onLocked} />

      <FormatToggle onLocked={onLocked} />

      {!exporter.exportedUrl && !exporter.isExporting && (
        <button onClick={onExport} aria-label="Export video" className={primaryBtn}>
          Export MP4
        </button>
      )}

      {exporter.isExporting && (
        <div
          className="flex flex-col items-center gap-3 w-full"
          role="progressbar"
          aria-valuenow={Math.round(exporter.exportProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div className="w-full h-0.75 bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${exporter.exportProgress}%`,
                background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              }}
            />
          </div>
          <div className="flex items-center justify-between w-full">
            <span className="text-white/60 text-xs">
              Exporting&nbsp;{Math.round(exporter.exportProgress)}%
            </span>
            <button onClick={exporter.cancelExport} aria-label="Cancel export" className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {exporter.exportedUrl && (
        <button onClick={onDownload} aria-label="Download exported video" className={primaryBtn}>
          Download
        </button>
      )}

      {exporter.error && (
        <p role="alert" className="text-red-400 text-sm text-center max-w-xs">
          {exporter.error}
        </p>
      )}

      <button onClick={onReset} aria-label="Create another video" className={ghostBtn}>
        Create another
      </button>
    </div>
  );
}
