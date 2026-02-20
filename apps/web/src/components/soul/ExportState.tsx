'use client';

import VideoPreview from '@/components/primitives/VideoPreview';
import PlaybackControls from '@/components/primitives/PlaybackControls';
import CaptionEditor from './CaptionEditor';
import StyleControls from './StyleControls';
import FormatToggle from './FormatToggle';
import type { UsePlaybackReturn } from '@/hooks/usePlayback';
import type { WaveformVariant, CaptionVariant, FormatVariant } from '@/lib/store';

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
  onExport: () => void;
  onDownload: () => void;
  onReset: () => void;
}

export default function ExportState({
  playback,
  exporter,
  format,
  waveformStyle,
  captionStyle,
  onExport,
  onDownload,
  onReset,
}: ExportStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 animate-fadeIn w-full max-w-sm">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full bg-green-500/[0.12] flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            className="w-[1.125rem] h-[1.125rem] text-green-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-[1.375rem] font-[300] tracking-[-0.02em]">Ready to share</h2>
      </div>

      <VideoPreview format={format} waveformStyle={waveformStyle} captionStyle={captionStyle} />

      <PlaybackControls playback={playback} className="w-full" />

      <CaptionEditor currentTime={playback.currentTime} />

      <StyleControls />

      <FormatToggle />

      {!exporter.exportedUrl && !exporter.isExporting && (
        <button
          onClick={onExport}
          aria-label="Export video"
          className="w-full sm:w-auto px-10 py-3.5 bg-white text-black rounded-full
                     text-[0.9375rem] font-[600] tracking-[-0.01em]
                     hover:bg-white/92 transition-all duration-200
                     hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                     shadow-[0_8px_32px_rgba(255,255,255,0.08)]"
        >
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
          <div className="w-full h-[3px] bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${exporter.exportProgress}%`,
                background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              }}
            />
          </div>
          <div className="flex items-center justify-between w-full">
            <span className="text-white/35 text-xs">
              Exporting&nbsp;{Math.round(exporter.exportProgress)}%
            </span>
            <button
              onClick={exporter.cancelExport}
              className="text-white/25 text-xs hover:text-white/55
                         transition-colors duration-150 cursor-pointer"
              aria-label="Cancel export"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {exporter.exportedUrl && (
        <button
          onClick={onDownload}
          aria-label="Download exported video"
          className="w-full sm:w-auto px-10 py-3.5 bg-white text-black rounded-full
                     text-[0.9375rem] font-[600] tracking-[-0.01em]
                     hover:bg-white/92 transition-all duration-200
                     hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                     shadow-[0_8px_32px_rgba(255,255,255,0.08)]"
        >
          Download
        </button>
      )}

      {exporter.error && (
        <p role="alert" className="text-red-400 text-sm text-center max-w-xs">
          {exporter.error}
        </p>
      )}

      <button
        onClick={onReset}
        aria-label="Create another video"
        className="text-white/28 text-sm hover:text-white/55
                   transition-colors duration-150 cursor-pointer"
      >
        Create another
      </button>
    </div>
  );
}
