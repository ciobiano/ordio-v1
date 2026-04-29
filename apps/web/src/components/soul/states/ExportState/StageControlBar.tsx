'use client'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { useFeatureGates } from '@/hooks/auth/useFeatureGates'
import LockBadge from '@/components/ui/LockBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FeatureKey } from '@/lib/featureGates'
import type { CanvasLayout, CaptionMode, FormatVariant } from '@/stores'

const FORMATS = [
  { value: 'square' as FormatVariant, label: '1:1' },
  { value: 'vertical' as FormatVariant, label: '9:16', gate: 'format_vertical' as FeatureKey },
  { value: 'horizontal' as FormatVariant, label: '16:9', gate: 'format_horizontal' as FeatureKey },
  { value: 'instagram' as FormatVariant, label: '4:5', gate: 'format_instagram' as FeatureKey },
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

interface StageControlBarProps {
  onLocked?: (feature: FeatureKey) => void
}

export function StageControlBar({ onLocked }: StageControlBarProps) {
  const format = useUIStore((s) => s.format)
  const setFormat = useUIStore((s) => s.setFormat)
  const captionMode = useUIStore((s) => s.captionMode)
  const setCaptionMode = useUIStore((s) => s.setCaptionMode)
  const canvasLayout = useUIStore((s) => s.canvasLayout)
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout)
  const { isLocked } = useFeatureGates()

  return (
    <div className="relative flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      <Select value={format} onValueChange={(v) => setFormat(v as FormatVariant)}>
        <SelectTrigger size="sm" className="h-11 rounded-xl bg-white/5 px-3 text-[length:var(--text-callout)] text-white/70 hover:bg-white/8 border-0">
          <span className="text-white/40">Format</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" className="bg-[color:var(--glass-bg)] backdrop-blur-xl border-white/8">
          {FORMATS.map((opt) => {
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
