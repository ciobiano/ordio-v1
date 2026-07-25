'use client';

import { useCallback } from 'react';
import { getCanvasDimensions, useCaptureStore, useUIStore } from '@/stores';
import { useVideoExporter, fileExtension } from '@/hooks/video/useVideoExporter';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useExportGate } from '@/hooks/billing/useExportGate';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import { studioButton, studioCard } from '@/lib/studioVariants';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

interface StudioExportBodyProps {
  playback: UsePlaybackReturn;
}

export function StudioExportBody({ playback }: StudioExportBodyProps) {
  const format = useUIStore((s) => s.format);
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const captionMode = useUIStore((s) => s.captionMode);
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setUpgradeTarget = useUIStore((s) => s.setUpgradeTarget);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const { tier } = useCurrentUser();
  const exporter = useVideoExporter();
  const exportGate = useExportGate();
  const { isLocked } = useFeatureGates();

  const showWatermark = tier === 'free';

  const handleExport = useCallback(async () => {
    if (!audioBuffer) return;

    const style = useUIStore.getState().style;

    // Video backgrounds preview free, but export is creator-gated.
    if (style.background?.type === 'video' && isLocked('background_video')) {
      setUpgradeTarget('background_video');
      return;
    }

    const gate = await exportGate.checkAndConsume();
    if (!gate.allowed) {
      setUpgradeTarget('export_limit');
      return;
    }
    const { width, height } = getCanvasDimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    await exporter.startExport(canvas, audioBuffer, showWatermark);
  }, [audioBuffer, isLocked, exportGate, setUpgradeTarget, format, exporter, showWatermark]);

  const handleDownload = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  if (!audioBuffer) {
    return (
      <div className="text-sm text-acid-text-3">
        Open a clip from the Library before exporting.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-8">
      <div className="relative w-67.5 flex-none rounded-acid-lg overflow-hidden border border-acid-border-default shadow-2xl">
        <CanvasPreview
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          captionMode={captionMode}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle ?? undefined}
          showWatermark={showWatermark}
        />
      </div>

      <div className="w-72 flex flex-col gap-3.5 pt-2">
        <div className="font-acid-display font-semibold text-[19px] text-acid-text-1">
          Export this clip
        </div>
        <div className="text-xs text-acid-text-3 -mt-2">
          Format and style come from the inspector on the right.
        </div>

        {exporter.isExporting ? (
          <div className={studioCard()}>
            <div className="flex justify-between text-xs font-bold text-acid-text-1 mb-2">
              Rendering… <span>{Math.round(exporter.exportProgress)}%</span>
            </div>
            <div className="h-1.5 rounded bg-acid-surface-2 overflow-hidden">
              <div
                className="h-full bg-acid-accent transition-[width] duration-150"
                style={{ width: `${exporter.exportProgress}%` }}
              />
            </div>
            <button
              onClick={exporter.cancelExport}
              className={studioButton({ variant: 'secondary' }) + ' mt-3'}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className={studioButton({ variant: 'primary' })} onClick={() => void handleExport()}>
            Render video
          </button>
        )}

        {exporter.exportedUrl && !exporter.isExporting && (
          <button className={studioButton({ variant: 'secondary' })} onClick={handleDownload}>
            Download ↓
          </button>
        )}

        {exporter.error && !exporter.isExporting && (
          <div className="text-xs text-acid-error">{exporter.error}</div>
        )}

        {showWatermark && (
          <div className="text-[11px] text-acid-text-3">
            Free tier exports include a watermark.
          </div>
        )}
      </div>
    </div>
  );
}
