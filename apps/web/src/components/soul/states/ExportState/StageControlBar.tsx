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

const WAVEFORM_OPTIONS: { value: WaveformVariant | 'graphics'; label: string; gate?: FeatureKey }[] = [
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

// Graphics options shown when waveform style supports them
const GRAPHICS_OPTIONS: { value: GraphicStyleId; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
]

// Waveform styles that support graphics
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

  // Combined waveform + graphics label (no redundant "Graphics:" prefix)
  const getWaveformLabel = useCallback(() => {
    const wf = WAVEFORM_OPTIONS.find(o => o.value === waveformStyle)
    if (!wf) return 'Waveform'
    if (waveformStyle === 'graphics' && graphicStyle) {
      const gfx = GRAPHICS_OPTIONS.find(o => o.value === graphicStyle)
      return gfx ? `Waveform: ${gfx.label}` : 'Waveform'
    }
    return wf.label
  }, [waveformStyle, graphicStyle])

  return (
    <div className="relative flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {/* Waveform + Graphics combined selector */}
      <Popover open={waveformOpen} onOpenChange={setWaveformOpen}>
        <PopoverTrigger
          className="flex h-11 items-center gap-2 rounded-xl bg-white/5 px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8"
        >
          <span className="text-white/40">Waveform</span>
          <span className="text-white/70">{getWaveformLabel()}</span>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto p-2 bg-[color:var(--glass-bg)] backdrop-blur-xl border-white/8">
          {WAVEFORM_OPTIONS.map((opt) => {
            const locked = opt.gate ? isLocked(opt.gate) : false
            const isSelected = waveformStyle === opt.value
            const isGraphics = opt.value === 'graphics'

            return (
              <div key={opt.value}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (isGraphics) {
                      // Toggle submenu expansion (don't close popover)
                      setGraphicsExpanded(!graphicsExpanded)
                      setWaveformStyle('graphics')
                    } else {
                      // Close popover on selection
                      setWaveformStyle(opt.value)
                      if (opt.value !== 'bars' && opt.value !== 'circle') {
                        setGraphicStyle(null)
                      }
                      setGraphicsExpanded(false)
                      setWaveformOpen(false)
                    }
                  }}
                  className={cn(
                    'flex items-center w-full px-3 py-2 rounded-lg text-sm transition-colors',
                    isSelected ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8',
                    locked && 'opacity-50'
                  )}
                >
                  <span className="flex-1 text-left">{opt.label}</span>
                  {isGraphics && (
                    <span className="text-white/40 mr-2">{graphicsExpanded ? '↑' : '→'}</span>
                  )}
                  {locked && opt.gate && (
                    <LockBadge onClick={(e) => { e.stopPropagation(); onLocked?.(opt.gate!)}} label={`${opt.label} requires Creator`} />
                  )}
                </button>
                {/* Graphics sub-options (inline expansion, popover stays open) */}
                {isGraphics && graphicsExpanded && (
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
                          'flex items-center w-full px-3 py-1.5 rounded-md text-sm transition-colors',
                          graphicStyle === gfx.value
                            ? 'bg-white/10 text-white'
                            : 'text-white/60 hover:bg-white/5'
                        )}
                      >
                        {gfx.label}
                      </button>
                    ))}
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
