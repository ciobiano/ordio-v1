'use client'

import Image from 'next/image'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import CanvasPreview from '@/components/primitives/CanvasPreview'
import PlaybackControls from '@/components/primitives/PlaybackControls'
import type { UsePlaybackReturn } from '@/hooks/usePlayback'
import type { WaveformVariant, CaptionMode, CanvasLayout, FormatVariant, GraphicStyleId } from '@/lib/store'

const FORMAT_RATIO: Record<FormatVariant, string> = {
  square: '1:1',
  vertical: '9:16',
  horizontal: '16:9',
  instagram: '4:5',
}

interface ExportCanvasProps {
  playback: UsePlaybackReturn
  format: FormatVariant
  waveformStyle: WaveformVariant
  captionMode: CaptionMode
  canvasLayout?: CanvasLayout
  graphicStyle?: GraphicStyleId
  showWatermark?: boolean
}

export function ExportCanvas({
  playback,
  format,
  waveformStyle,
  captionMode,
  canvasLayout,
  graphicStyle,
  showWatermark,
}: ExportCanvasProps) {
  const handlePlayToggle = useCallback(() => {
    if (playback.isPlaying) playback.pause()
    else playback.play()
  }, [playback])

  return (
    <div className="flex flex-col md:flex-1 min-w-0">
      <div className="flex justify-center px-4 md:px-0 shrink-0">
        <div className="relative">
          <CanvasPreview
            playback={playback}
            format={format}
            waveformStyle={waveformStyle}
            captionMode={captionMode}
            canvasLayout={canvasLayout}
            graphicStyle={graphicStyle}
            showWatermark={showWatermark}
          />

          <Button
            type="button"
            variant="ghost"
            onClick={handlePlayToggle}
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
            disabled={playback.duration === 0}
            className={cn(
              'absolute inset-0 h-auto w-auto rounded-none flex items-center justify-center',
              'transition-opacity duration-150 hover:bg-transparent',
              playback.isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100',
              'disabled:cursor-not-allowed'
            )}
          >
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors duration-150">
              {playback.isPlaying ? (
                <Image src="/icons/pause.svg" width={20} height={20} alt="" aria-hidden="true" className="invert" />
              ) : (
                <Image src="/icons/play.svg" width={20} height={20} alt="" aria-hidden="true" className="invert ml-0.5" />
              )}
            </div>
          </Button>

          <span
            className="absolute top-2 right-2 text-xs font-medium
                       tracking-wider uppercase text-white/50 bg-black/50 px-1.5 py-0.5
                       rounded pointer-events-none"
            aria-hidden="true"
          >
            {FORMAT_RATIO[format]}
          </span>
        </div>
      </div>

      <div className="px-4 md:px-0 pt-3 pb-1 shrink-0">
        <PlaybackControls playback={playback} className="w-full" />
      </div>
    </div>
  )
}
