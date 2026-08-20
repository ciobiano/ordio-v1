'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import CanvasPreview from '@/components/media/video/CanvasPreview'
import { getCanvasDimensions } from '@/stores'
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
  /** A bottom panel is open, so the stage is running at reduced height. */
  stageShrunk?: boolean
}

/**
 * The stage.
 *
 * Sized by its container's *height*, not just its width. This element is a
 * size container, so `100cqh` is whatever vertical space is left after the
 * transport bar and the bottom surface have taken theirs — which means opening
 * a panel shrinks the canvas rather than pushing it off-screen or forcing the
 * page to scroll. The aspect ratio is held throughout, so the artwork only ever
 * changes scale.
 *
 * `min()` picks whichever constraint binds: width on a tall stage, height on a
 * short one. Container query units resolve against the content box, so the
 * padding here is already excluded and needs no subtraction.
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
  stageShrunk = false,
}: ExportCanvasProps) {
  const { width, height } = getCanvasDimensions(format)
  const aspectRatio = width / height

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 justify-center px-4 pt-3 sm:px-6',
        // Mobile only. `container-type: size` makes an element's height stop
        // depending on its contents, which collapses it to zero in the
        // desktop column, where height is content-driven rather than flexed.
        '[container-type:size] md:[container-type:normal]'
      )}
      style={{ '--canvas-aspect-ratio': aspectRatio } as CSSProperties}
    >
      <div
        className={cn(
          'relative flex max-w-[28rem] flex-col self-start',
          'w-[min(100%,calc(100cqh*var(--canvas-aspect-ratio)))] md:w-full',
          'transition-[width] duration-300 ease-out motion-reduce:transition-none'
        )}
      >
        <CanvasPreview
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          canvasLayout={canvasLayout}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
          onLocked={onLocked}
          hidePlayBadge={stageShrunk}
        />
      </div>
    </div>
  )
}
