'use client'

import CanvasPreview from '@/components/primitives/video/CanvasPreview'
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback'
import type { WaveformVariant, CanvasLayout, FormatVariant, GraphicStyleId } from '@/stores'
import type { FeatureKey } from '@/lib/featureGates'

interface ExportCanvasProps {
  playback: UsePlaybackReturn
  format: FormatVariant
  waveformStyle: WaveformVariant
  canvasLayout?: CanvasLayout
  graphicStyle?: GraphicStyleId
  showWatermark?: boolean
  onLocked?: (feature: FeatureKey) => void
}

/**
 * The stage.
 *
 * Holds only the canvas now. The header floats over it (rendered by ExportState
 * as a sibling in the same relative box) and transport moved to its own bar, so
 * there is no chrome here to steal height from the artwork.
 *
 * StageControlBar used to sit under this on desktop, carrying Visual, Animation
 * and Stage. All three live in the Style panel's tabs, which desktop also has,
 * so the bar was two ways to set the same thing and is gone.
 */
export function ExportCanvas({
  playback,
  format,
  waveformStyle,
  canvasLayout,
  graphicStyle,
  showWatermark,
  onLocked,
}: ExportCanvasProps) {
  return (
    <div className="flex min-h-0 flex-1 shrink flex-col items-center justify-start px-4 pt-3 sm:px-6">
      <div className="relative flex w-full max-w-[calc(100vw-2rem)] flex-col sm:max-w-[28rem]">
        <CanvasPreview
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
          onLocked={onLocked}
        />
      </div>
    </div>
  )
}
