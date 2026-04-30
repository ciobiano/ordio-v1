'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { useFeatureGates } from '@/hooks/auth/useFeatureGates'
import LockBadge from '@/components/ui/LockBadge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FeatureKey } from '@/lib/featureGates'
import type { CanvasLayout, CaptionMode, WaveformVariant, GraphicStyleId } from '@/stores'

// Display options (waveform styles + Graphics pseudo-option)
const DISPLAY_OPTIONS: { value: WaveformVariant | 'graphics'; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Circle', gate: 'waveform_circle' as FeatureKey },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' as FeatureKey },
  { value: 'none', label: 'None' },
  { value: 'graphics', label: 'Graphics' },
]

const MODES = [
  { value: 'phrase' as CaptionMode, label: 'Phrase' },
  { value: 'karaoke' as CaptionMode, label: 'Karaoke', gate: 'caption_karaoke' as FeatureKey },
]

const LAYOUTS = [
  { value: 'top' as CanvasLayout, label: 'Top' },
  { value: 'compact' as CanvasLayout, label: 'Compact' },
  { value: 'flipped' as CanvasLayout, label: 'Flipped', gate: 'layout_flipped' as FeatureKey },
]

const GRAPHICS_OPTIONS: { value: GraphicStyleId; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
]

const GRAPHIC_WAVEFORMS: WaveformVariant[] = ['bars', 'circle']

interface StageControlBarProps {
  onLocked?: (feature: FeatureKey) => void
}

export function StageControlBar({ onLocked }: StageControlBarProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle)
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle)
  const captionMode = useUIStore((s) => s.captionMode)
  const setCaptionMode = useUIStore((s) => s.setCaptionMode)
  const canvasLayout = useUIStore((s) => s.canvasLayout)
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout)
  const graphicStyle = useUIStore((s) => s.graphicStyle)
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle)
  const { isLocked } = useFeatureGates()
  const [waveformOpen, setWaveformOpen] = useState(false)
  const [graphicsExpanded, setGraphicsExpanded] = useState(false)

  // Reset submenu when popover closes
  useEffect(() => {
    if (!waveformOpen) setGraphicsExpanded(false)
  }, [waveformOpen])

  // Combined display label (covers waveform, graphics, visual artifacts)
  const getDisplayLabel = useCallback(() => {
    // If a graphic style is selected, show it in the label
    if (graphicStyle) {
      const gfx = GRAPHICS_OPTIONS.find(o => o.value === graphicStyle)
      return gfx ? `Display: ${gfx.label}` : 'Display'
    }
    // Otherwise show the waveform style
    const wf = DISPLAY_OPTIONS.find(o => o.value === waveformStyle)
    return wf ? wf.label : 'Display'
  }, [waveformStyle, graphicStyle])

  return (
    <div className="relative flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {/* Waveform + Graphics combined selector */}
      <Popover open={waveformOpen} onOpenChange={setWaveformOpen}>
        <PopoverTrigger
          className="flex h-11 items-center gap-2 rounded-xl bg-white/5 px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8"
        >
          <span className="text-white/40">Display</span>
          <span className="text-white/70">{getDisplayLabel()}</span>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          className="w-[14rem] p-2 bg-[color:var(--glass-bg)] backdrop-blur-xl border-white/8"
        >
          {DISPLAY_OPTIONS.map((opt) => {
            const locked = opt.gate ? isLocked(opt.gate) : false
            const isSelected =
              opt.value === 'graphics'
                ? graphicStyle !== null
                : waveformStyle === opt.value
            const isGraphics = opt.value === 'graphics'
            const lockFeature = opt.gate

            return (
              <div key={opt.value}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (isGraphics) {
                      // Toggle submenu expansion (don't close popover)
                      setGraphicsExpanded(!graphicsExpanded)
                      // Don't set waveformStyle to 'graphics' — it's not a valid WaveformVariant
                    } else {
                      // Close popover on selection
                      setWaveformStyle(opt.value as WaveformVariant)
                      if (!GRAPHIC_WAVEFORMS.includes(opt.value as WaveformVariant)) {
                        setGraphicStyle(null)
                      }
                      setGraphicsExpanded(false)
                      setWaveformOpen(false)
                    }
                  }}
                  className={cn(
                    'group flex h-9 w-full items-center rounded-lg px-3 text-sm transition-colors duration-200 ease-out motion-reduce:transition-none',
                    isSelected ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8',
                    locked && 'opacity-50'
                  )}
                >
                  <span className="flex-1 truncate text-left">{opt.label}</span>
                  {isGraphics && (
                    <span
                      className={cn(
                        'mr-1 inline-flex h-4 w-4 items-center justify-center text-white/45 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                        graphicsExpanded && 'rotate-90'
                      )}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  )}
                  {locked && lockFeature && (
                    <LockBadge onClick={() => onLocked?.(lockFeature)} label={`${opt.label} requires Creator`} />
                  )}
                </button>
                {/* Graphics sub-options (inline expansion, popover stays open) */}
                {isGraphics && (
                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      graphicsExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="min-h-0">
                      <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                    {GRAPHICS_OPTIONS.filter(g => g.value !== null).map((gfx) => (
                      <button
                        key={String(gfx.value)}
                        type="button"
                        onClick={() => {
                          setGraphicStyle(gfx.value)
                          setGraphicsExpanded(false)
                          setWaveformOpen(false) // Close popover on final selection
                        }}
                        className={cn(
                          'flex h-8 w-full items-center rounded-md px-3 text-sm transition-colors duration-200 ease-out motion-reduce:transition-none',
                          graphicStyle === gfx.value
                            ? 'bg-white/10 text-white'
                            : 'text-white/60 hover:bg-white/5'
                        )}
                      >
                        {gfx.label}
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

      <Select value={captionMode} onValueChange={(v) => setCaptionMode(v as CaptionMode)}>
        <SelectTrigger size="sm" className="h-11 rounded-xl bg-white/[0.04] px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8 border-0">
          <span className="text-white/40">Mode</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" className="bg-[color:var(--glass-bg)] backdrop-blur-xl border-white/8">
          {MODES.map((opt) => {
            const locked = opt.gate ? isLocked(opt.gate) : false
            return (
              <SelectItem
                key={opt.value}
                value={opt.value}
                disabled={locked}
                className="text-[length:var(--text-callout)] text-white/70 focus:bg-white/10 focus:text-white"
              >
                {opt.label}
                {locked && opt.gate && (
                  <LockBadge onClick={() => onLocked?.(opt.gate!)} label={`${opt.label} requires Creator`} />
                )}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select value={canvasLayout} onValueChange={(v) => setCanvasLayout(v as CanvasLayout)}>
        <SelectTrigger size="sm" className="h-11 rounded-xl bg-white/[0.04] px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8 border-0">
          <span className="text-white/40">Layout</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" className="bg-[color:var(--glass-bg)] backdrop-blur-xl border-white/8">
          {LAYOUTS.map((opt) => {
            const locked = opt.gate ? isLocked(opt.gate) : false
            return (
              <SelectItem
                key={opt.value}
                value={opt.value}
                disabled={locked}
                className="text-[length:var(--text-callout)] text-white/70 focus:bg-white/10 focus:text-white"
              >
                {opt.label}
                {locked && opt.gate && (
                  <LockBadge onClick={() => onLocked?.(opt.gate!)} label={`${opt.label} requires Creator`} />
                )}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
