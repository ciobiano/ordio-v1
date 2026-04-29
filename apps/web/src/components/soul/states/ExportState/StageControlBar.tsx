'use client'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { useFeatureGates } from '@/hooks/auth/useFeatureGates'
import LockBadge from '@/components/ui/LockBadge'
import type { FeatureKey } from '@/lib/featureGates'
import type { CanvasLayout, CaptionMode, FormatVariant } from '@/stores'

const FORMATS: { value: FormatVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'square', label: '1:1' },
  { value: 'vertical', label: '9:16', gate: 'format_vertical' },
  { value: 'horizontal', label: '16:9', gate: 'format_horizontal' },
  { value: 'instagram', label: '4:5', gate: 'format_instagram' },
]

const MODES: { value: CaptionMode; label: string; gate?: FeatureKey }[] = [
  { value: 'phrase', label: 'Phrase' },
  { value: 'karaoke', label: 'Karaoke', gate: 'caption_karaoke' },
]

const LAYOUTS: { value: CanvasLayout; label: string; gate?: FeatureKey }[] = [
  { value: 'top', label: 'Top' },
  { value: 'compact', label: 'Compact' },
  { value: 'flipped', label: 'Flipped', gate: 'layout_flipped' },
]

interface StageControlBarProps {
  onLocked?: (feature: FeatureKey) => void
}

function ControlGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  onLocked,
}: {
  label: string
  value: T
  options: { value: T; label: string; gate?: FeatureKey }[]
  onChange: (value: T) => void
  onLocked?: (feature: FeatureKey) => void
}) {
  const { isLocked } = useFeatureGates()

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-white/34">
        {label}
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        {options.map((option) => {
          const locked = option.gate ? isLocked(option.gate) : false
          const selected = value === option.value
          return (
            <div key={option.value} className="relative">
              <button
                type="button"
                onClick={() => (locked ? onLocked?.(option.gate!) : onChange(option.value))}
                aria-pressed={selected}
                className={cn(
                  'min-h-10 rounded-xl px-3 text-sm transition-colors',
                  selected
                    ? 'bg-white text-slate-950 font-medium'
                    : 'text-white/72 hover:bg-white/8'
                )}
              >
                {option.label}
              </button>
              {locked && option.gate && (
                <LockBadge
                  onClick={() => onLocked?.(option.gate!)}
                  label={`${option.label} requires Creator`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StageControlBar({ onLocked }: StageControlBarProps) {
  const format = useUIStore((s) => s.format)
  const setFormat = useUIStore((s) => s.setFormat)
  const captionMode = useUIStore((s) => s.captionMode)
  const setCaptionMode = useUIStore((s) => s.setCaptionMode)
  const canvasLayout = useUIStore((s) => s.canvasLayout)
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout)

  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ControlGroup label="Format" value={format} options={FORMATS} onChange={setFormat} onLocked={onLocked} />
      <ControlGroup label="Mode" value={captionMode} options={MODES} onChange={setCaptionMode} onLocked={onLocked} />
      <ControlGroup label="Layout" value={canvasLayout} options={LAYOUTS} onChange={setCanvasLayout} onLocked={onLocked} />
    </div>
  )
}
