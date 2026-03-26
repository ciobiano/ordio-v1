'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { useFeatureGates } from '@/hooks/useFeatureGates'
import LockBadge from '@/components/primitives/LockBadge'
import type { FeatureKey } from '@/lib/featureGates'
import type { WaveformVariant, CanvasLayout, CaptionMode, EnhanceTier, GraphicStyleId } from '@/lib/store'

interface RecordingSettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  onLocked: (feature: FeatureKey) => void
}

type GraphicVariant = NonNullable<GraphicStyleId>

const WAVEFORM_OPTIONS: { value: WaveformVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Circle', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'None' },
]

const GRAPHIC_OPTIONS: { value: GraphicVariant; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
]

const LAYOUT_OPTIONS: { value: CanvasLayout; label: string; gate?: FeatureKey }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact',  label: 'Compact' },
  { value: 'flipped',  label: 'Flipped', gate: 'layout_flipped' },
]

const MODE_OPTIONS: { value: CaptionMode; label: string; gate?: FeatureKey }[] = [
  { value: 'phrase',  label: 'Phrase' },
  { value: 'karaoke', label: 'Karaoke', gate: 'caption_karaoke' },
]

const ENHANCE_OPTIONS: { value: EnhanceTier; label: string; desc: string; gate?: FeatureKey }[] = [
  { value: 'none', label: 'Standard', desc: 'No processing' },
  { value: 'clean', label: 'Clean', desc: 'AI noise removal (~3s)', gate: 'enhance_clean' },
  { value: 'hd', label: 'HD Remaster', desc: 'Denoise + enhance (~15s)', gate: 'enhance_hd' },
]

// ── Segmented Control ────────────────────────────────────────────────────────
interface SegmentOption<T extends string> {
  value: T
  label: string
  gate?: FeatureKey
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  onLocked,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  onLocked: (feature: FeatureKey) => void
}) {
  const { isLocked } = useFeatureGates()
  return (
    <div className="flex rounded-xl border border-white/[0.12] overflow-hidden">
      {options.map((opt) => {
        const locked = opt.gate ? isLocked(opt.gate) : false
        const isActive = value === opt.value
        return (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            className={cn(
              'relative flex-1 py-[9px] text-sm transition-colors duration-150 min-h-9 rounded-none h-auto hover:bg-transparent',
              isActive
                ? 'bg-accent text-foreground font-semibold hover:bg-accent'
                : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
              locked && 'opacity-40'
            )}
            onClick={() => locked ? onLocked(opt.gate!) : onChange(opt.value)}
          >
            {opt.label}
            {locked && opt.gate && (
              <LockBadge
                onClick={() => onLocked(opt.gate!)}
                label={`${opt.label} requires Creator`}
              />
            )}
          </Button>
        )
      })}
    </div>
  )
}

// ── Sheet ────────────────────────────────────────────────────────────────────
export function RecordingSettingsSheet({ isOpen, onClose, onLocked }: RecordingSettingsSheetProps) {
  const waveformStyle = useStore((s) => s.waveformStyle)
  const setWaveformStyle = useStore((s) => s.setWaveformStyle)
  const graphicStyle = useStore((s) => s.graphicStyle)
  const setGraphicStyle = useStore((s) => s.setGraphicStyle)
  const canvasLayout = useStore((s) => s.canvasLayout)
  const setCanvasLayout = useStore((s) => s.setCanvasLayout)
  const captionMode = useStore((s) => s.captionMode)
  const setCaptionMode = useStore((s) => s.setCaptionMode)
  const enhanceTier = useStore((s) => s.enhanceTier)
  const setEnhanceTier = useStore((s) => s.setEnhanceTier)
  const { isLocked } = useFeatureGates()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-0 p-0',
          'rounded-t-[24px] sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[440px] sm:rounded-[24px]',
          'bg-[--surface-glass] backdrop-blur-[40px] backdrop-saturate-[160%]',
          '[box-shadow:inset_0_1px_0_rgba(255,255,255,0.20),0_0_0_0.5px_rgba(255,255,255,0.10),0_-12px_40px_rgba(0,0,0,0.8),0_-2px_8px_rgba(0,0,0,0.5)]',
          'max-h-[70vh] overflow-y-auto'
        )}
      >
        {/* Drag handle + close */}
        <div className="relative flex justify-center pt-3 pb-2">
          <div className="w-10 h-[5px] rounded-full bg-white/[0.28]" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close settings"
            onClick={onClose}
            className={cn(
              'absolute right-0 top-0 h-auto w-auto',
              'min-w-[44px] min-h-[44px] rounded-full hover:bg-transparent',
            )}
          >
            <span className={cn(
              'w-7 h-7 rounded-full',
              'bg-white/10 border border-white/10',
              'flex items-center justify-center',
              'hover:bg-white/[0.15] transition-colors duration-150'
            )}>
              <Image src="/icons/close.svg" width={12} height={12} alt="" aria-hidden="true" className="invert opacity-55" />
            </span>
          </Button>
        </div>

        <div className="px-5 pb-8 space-y-6">

          {/* Waveform Style */}
          <section>
            <h3 className="text-xs font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Waveform Style
            </h3>
            <SegmentedControl
              options={WAVEFORM_OPTIONS}
              value={waveformStyle}
              onChange={(v) => { setWaveformStyle(v); setGraphicStyle(null) }}
              onLocked={onLocked}
            />
            <div
              aria-disabled={captionMode === 'karaoke'}
              className={cn(captionMode === 'karaoke' && 'opacity-40 pointer-events-none')}
            >
              <p className="text-xs text-muted-foreground mt-3 mb-2">
                Graphic overlay
                {captionMode === 'karaoke' && (
                  <span className="ml-1">— unavailable in Karaoke</span>
                )}
              </p>
              <SegmentedControl
                options={GRAPHIC_OPTIONS}
                value={graphicStyle ?? ('' as GraphicVariant)}
                onChange={(v) => {
                  const next = graphicStyle === v ? null : v
                  setGraphicStyle(next)
                  if (next !== null) setWaveformStyle('none')
                }}
                onLocked={onLocked}
              />
            </div>
          </section>

          <div className="h-px bg-white/[0.08]" />

          {/* Caption Layout */}
          <section>
            <h3 className="text-xs font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Caption Layout
            </h3>
            <SegmentedControl
              options={LAYOUT_OPTIONS}
              value={canvasLayout}
              onChange={setCanvasLayout}
              onLocked={onLocked}
            />
            <p className="text-xs text-muted-foreground mt-3 mb-2">Caption mode</p>
            <SegmentedControl
              options={MODE_OPTIONS}
              value={captionMode}
              onChange={setCaptionMode}
              onLocked={onLocked}
            />
          </section>

          <div className="h-px bg-white/[0.08]" />

          {/* Audio Enhancement */}
          <section>
            <h3 className="text-xs font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Audio Enhancement
            </h3>
            <div>
              {ENHANCE_OPTIONS.map((opt, i) => {
                const isActive = enhanceTier === opt.value
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant="ghost"
                    className={cn(
                      'relative w-full flex items-center gap-3 py-3 text-left transition-colors duration-150 h-auto justify-start',
                      i < ENHANCE_OPTIONS.length - 1 && 'border-b border-white/[0.08]',
                      'rounded-lg px-2',
                      isActive ? 'bg-accent hover:bg-accent' : 'hover:bg-muted',
                      opt.gate && isLocked(opt.gate) && 'opacity-40'
                    )}
                    onClick={() => (opt.gate && isLocked(opt.gate)) ? onLocked(opt.gate) : setEnhanceTier(opt.value)}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
                      isActive ? 'border-white/70 bg-white/70' : 'border-white/[0.25]'
                    )}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[rgba(18,18,20)]" />}
                    </div>
                    <div>
                      <div className={cn(
                        'text-sm font-medium transition-colors duration-150',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {opt.desc}
                      </div>
                    </div>
                    {opt.gate && isLocked(opt.gate) && (
                      <LockBadge
                        onClick={() => onLocked(opt.gate!)}
                        label={`${opt.label} requires Creator`}
                      />
                    )}
                  </Button>
                )
              })}
            </div>
          </section>

        </div>
      </SheetContent>
    </Sheet>
  )
}
