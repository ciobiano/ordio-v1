'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { useFeatureGates } from '@/hooks/auth/useFeatureGates'
import LockBadge from '@/components/ui/LockBadge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HugeiconsIcon } from '@hugeicons/react'
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import type { FeatureKey } from '@/lib/featureGates'
import type { CaptionStyleId, GraphicStyleId, WaveformVariant } from '@/stores'
import { getCaptionStylePreset } from '@Ordio/engine'
import { CAPTION_ANIMATIONS, findAnimationForStyle } from '@/lib/captionAnimations'

const DISPLAY_OPTIONS: { value: WaveformVariant | 'graphics'; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'orb', label: 'Orb' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'none', label: 'Clean' },
  { value: 'graphics', label: 'Frames' },
]

const GRAPHICS_OPTIONS: { value: Exclude<GraphicStyleId, null>; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
]



interface StageControlBarProps {
  onLocked?: (feature: FeatureKey) => void
}

export function StageControlBar({ onLocked }: StageControlBarProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle)
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle)
  const graphicStyle = useUIStore((s) => s.graphicStyle)
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle)
  const captionStyleId = useUIStore((s) => s.style.captionStyleId)
  const setStyle = useUIStore((s) => s.setStyle)
  const canvasLayout = useUIStore((s) => s.canvasLayout)
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout)
  const { isLocked } = useFeatureGates()
  const [displayOpen, setDisplayOpen] = useState(false)
  const [graphicsExpanded, setGraphicsExpanded] = useState(false)
  const lyricsOwnsStage = getCaptionStylePreset(captionStyleId).ownsStage

  useEffect(() => {
    if (!displayOpen) {
      setGraphicsExpanded(false)
    }
  }, [displayOpen])

  // Legacy persisted 'compact' (pre-migration edge) renders as Upper.
  const layoutFlipped = canvasLayout === 'flipped'
  const handleFlipStage = () => {
    if (!layoutFlipped && isLocked('layout_flipped')) {
      onLocked?.('layout_flipped')
      return
    }
    setCanvasLayout(layoutFlipped ? 'top' : 'flipped')
  }

  const displayLabel = lyricsOwnsStage
    ? 'Full-stage'
    : graphicStyle
      ? GRAPHICS_OPTIONS.find((option) => option.value === graphicStyle)?.label ?? 'Frames'
      : DISPLAY_OPTIONS.find((option) => option.value === waveformStyle)?.label ?? 'Bars'

  return (
    <div className="relative flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Popover open={displayOpen && !lyricsOwnsStage} onOpenChange={(open) => setDisplayOpen(lyricsOwnsStage ? false : open)}>
        <PopoverTrigger
          disabled={lyricsOwnsStage}
          className={cn(
            'flex w-fit items-center justify-between gap-1.5 h-11 rounded-xl border-0 bg-white/[0.04] px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8 whitespace-nowrap outline-none',
            lyricsOwnsStage && 'cursor-not-allowed opacity-45 hover:bg-white/[0.04]'
          )}
        >
          <span className="text-white/40">Visual</span>
          <span className="flex flex-1 text-left line-clamp-1">{displayLabel}</span>
          <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="pointer-events-none size-4 text-muted-foreground shrink-0" />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          className="w-[14rem] border-white/8 bg-[color:var(--sheet-bg)] p-2"
        >
          {DISPLAY_OPTIONS.map((option) => {
            const locked = option.gate ? isLocked(option.gate) : false
            const isSelected =
              option.value === 'graphics'
                ? graphicStyle !== null
                : graphicStyle === null && waveformStyle === option.value

            return (
              <div key={option.value}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (option.value === 'graphics') {
                      setGraphicsExpanded((current) => !current)
                      return
                    }

                    setGraphicStyle(null)
                    setWaveformStyle(option.value)
                    setGraphicsExpanded(false)
                    setDisplayOpen(false)
                  }}
                  className={cn(
                    'group flex h-9 w-full items-center rounded-lg px-3 text-sm transition-colors duration-200',
                    isSelected ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8',
                    locked && 'opacity-50'
                  )}
                >
                  <span className="flex-1 text-left">{option.label}</span>
                  {option.value === 'graphics' && (
                    <span
                      className={cn(
                        'mr-1 inline-flex h-4 w-4 items-center justify-center text-white/45 transition-transform duration-200',
                        graphicsExpanded && 'rotate-90'
                      )}
                    >
                      ›
                    </span>
                  )}
                  {locked && option.gate && (
                    <LockBadge onClick={() => onLocked?.(option.gate!)} label={`${option.label} requires Creator`} />
                  )}
                </button>

                {option.value === 'graphics' && (
                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200',
                      graphicsExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="min-h-0">
                      <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                        {GRAPHICS_OPTIONS.map((graphic) => (
                          <button
                            key={graphic.value}
                            type="button"
                            onClick={() => {
                              setGraphicStyle(graphic.value)
                              setDisplayOpen(false)
                              setGraphicsExpanded(false)
                            }}
                            className={cn(
                              'flex h-8 w-full items-center rounded-md px-3 text-sm transition-colors duration-200',
                              graphicStyle === graphic.value
                                ? 'bg-white/10 text-white'
                                : 'text-white/60 hover:bg-white/5'
                            )}
                          >
                            {graphic.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </PopoverContent>
      </Popover>

      <Select
        value={findAnimationForStyle(captionStyleId)?.styleId}
        onValueChange={(value) => setStyle({ captionStyleId: value as CaptionStyleId })}
      >
        <SelectTrigger
          size="sm"
          className="h-11 rounded-xl border-0 bg-white/[0.04] px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8"
        >
          <span className="text-white/40">Animation</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" className="border-white/8 bg-[color:var(--sheet-bg)]">
          {CAPTION_ANIMATIONS.map((option) => {
            const locked = option.gate ? isLocked(option.gate) : false
            return (
              <SelectItem
                key={option.mechanic}
                value={option.styleId}
                disabled={locked}
                className="text-[length:var(--text-callout)] text-white/70 focus:bg-white/10 focus:text-white"
              >
                {option.label}
                {locked && option.gate && (
                  <LockBadge onClick={() => onLocked?.(option.gate!)} label={`${option.label} requires Creator`} />
                )}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {/* Two-state flip: captions are freely draggable, so the old three-way
          preset ('Tight' middle option) was redundant — a single toggle flips
          the stage layout between upper and lower. */}
      <button
        type="button"
        onClick={handleFlipStage}
        aria-pressed={layoutFlipped}
        aria-label={layoutFlipped ? 'Flip stage to upper' : 'Flip stage to lower'}
        className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-0 bg-white/[0.04] px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8 whitespace-nowrap outline-none"
      >
        <span className="text-white/40">Stage</span>
        <span>{layoutFlipped ? 'Lower' : 'Upper'}</span>
        <HugeiconsIcon
          icon={UnfoldMoreIcon}
          strokeWidth={2}
          className={cn(
            'pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            layoutFlipped && 'rotate-180'
          )}
        />
      </button>
    </div>
  )
}
