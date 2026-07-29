'use client'

import CanvasPreview from '@/components/primitives/video/CanvasPreview'
import PlaybackControls from '@/components/primitives/video/PlaybackControls'
import { StageControlBar } from './StageControlBar'
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
    <div className="flex flex-col flex-1 min-w-0 pt-[env(safe-area-inset-top)] mt-16">
      <div className="flex justify-center shrink-0 px-4 sm:px-6">
        <div className="relative flex w-full max-w-[calc(100vw-2rem)] sm:max-w-[28rem] flex-col">
          <CanvasPreview
            playback={playback}
            format={format}
            waveformStyle={waveformStyle}
            canvasLayout={canvasLayout}
            graphicStyle={graphicStyle}
            showWatermark={showWatermark}
            onLocked={onLocked}
          />

          <div className="hidden md:block h-4" />

          {/* Visual style, Caption preset, and Stage flip live in StyleControls'
              tabs and a canvas-anchored icon on mobile — this row is desktop-only
              to avoid the horizontal-overflow bug it had at narrow widths. */}
          <div className="hidden md:flex">
            <StageControlBar onLocked={onLocked} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 shrink-0">
        <PlaybackControls playback={playback} className="w-full" />
      </div>
    </div>
  )
}
