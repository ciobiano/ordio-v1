// apps/web/src/components/soul/export/ExportStage.tsx
'use client';

import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import PlaybackControls from '@/components/primitives/video/PlaybackControls';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores';

interface ExportStageProps {
  playback: UsePlaybackReturn;
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  captionMode: CaptionMode;
  canvasLayout?: CanvasLayout;
  graphicStyle?: GraphicStyleId;
  showWatermark?: boolean;
}

export function ExportStage({
  playback,
  format,
  waveformStyle,
  captionMode,
  canvasLayout,
  graphicStyle,
  showWatermark,
}: ExportStageProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 pt-16 pb-32">
      <div className="relative w-full max-w-[min(100%,20rem)]">
        <CanvasPreview
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          captionMode={captionMode}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
        />
      </div>
      <PlaybackControls playback={playback} className="w-full max-w-[min(100%,20rem)]" />
    </div>
  );
}
