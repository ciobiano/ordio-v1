'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { useFeatureGates } from '@/hooks/useFeatureGates'
import LockBadge from '@/components/primitives/LockBadge'
import type { FeatureKey } from '@/lib/featureGates'
import type { WaveformVariant, CaptionVariant, EnhanceTier, GraphicStyleId } from '@/lib/store'

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

const CAPTION_OPTIONS: { value: CaptionVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center', gate: 'caption_center' },
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
          <button
            key={opt.value}
            type="button"
            className={cn(
              'relative flex-1 py-[9px] text-[length:var(--text-body-sm)] transition-colors duration-150 min-h-9',
              isActive
                ? 'bg-[--surface-selected] text-[--primary] font-semibold'
                : 'bg-transparent text-[--secondary] hover:bg-[--surface] hover:text-[--primary]',
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
          </button>
        )
      })}
    </div>
  )
}

// ── Sheet ────────────────────────────────────────────────────────────────────
export function RecordingSettingsSheet({ isOpen, onClose, onLocked }: RecordingSettingsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const waveformStyle = useStore((s) => s.waveformStyle)
  const setWaveformStyle = useStore((s) => s.setWaveformStyle)
  const graphicStyle = useStore((s) => s.graphicStyle)
  const setGraphicStyle = useStore((s) => s.setGraphicStyle)
  const captionStyle = useStore((s) => s.captionStyle)
  const setCaptionStyle = useStore((s) => s.setCaptionStyle)
  const enhanceTier = useStore((s) => s.enhanceTier)
  const setEnhanceTier = useStore((s) => s.setEnhanceTier)
  const { isLocked } = useFeatureGates()

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return
    const firstBtn = sheetRef.current.querySelector<HTMLButtonElement>('button')
    firstBtn?.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = sheetRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [isOpen])

  // Drag-down to dismiss
  const dragStartY = useRef<number | null>(null)
  const handlePointerDown = useCallback((e: React.PointerEvent) => { dragStartY.current = e.clientY }, [])
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return
    if (e.clientY - dragStartY.current > 100) { dragStartY.current = null; onClose() }
  }, [onClose])
  const handlePointerUp = useCallback(() => { dragStartY.current = null }, [])

  // Waveform value: when a graphic is selected, show it reflected in the graphic segment
  const activeWaveform = graphicStyle === null ? waveformStyle : waveformStyle

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Recording settings"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-[440px] rounded-t-[24px] sm:rounded-[24px] bg-[--surface-glass] backdrop-blur-[40px] backdrop-saturate-[160%] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.20),0_0_0_0.5px_rgba(255,255,255,0.10),0_-12px_40px_rgba(0,0,0,0.8),0_-2px_8px_rgba(0,0,0,0.5)] max-h-[70vh] overflow-y-auto animate-slideUp"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drag handle + close */}
        <div className="relative flex justify-center pt-3 pb-2">
          <div className="w-10 h-[5px] rounded-full bg-white/[0.28]" />
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className={cn(
              'absolute right-0 top-0',
              'min-w-[44px] min-h-[44px] flex items-center justify-center',
              'group cursor-pointer rounded-full',
              'focus-visible:ring-2 focus-visible:ring-white/60',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-black'
            )}
          >
            <span className={cn(
              'w-7 h-7 rounded-full',
              'bg-white/10 border border-white/10',
              'flex items-center justify-center',
              'group-hover:bg-white/[0.15] transition-colors duration-150'
            )}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/55" aria-hidden="true">
                <path d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z" fill="currentColor"/>
              </svg>
            </span>
          </button>
        </div>

        <div className="px-5 pb-8 space-y-6">

          {/* Waveform Style */}
          <section>
            <h3 className="text-[length:var(--text-footnote)] font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Waveform Style
            </h3>
            <SegmentedControl
              options={WAVEFORM_OPTIONS}
              value={activeWaveform}
              onChange={(v) => { setWaveformStyle(v); setGraphicStyle(null) }}
              onLocked={onLocked}
            />
            {/* Graphic overlay — separate segmented row */}
            <p className="text-[length:var(--text-footnote)] text-[--tertiary] mt-3 mb-2">Graphic overlay</p>
            <SegmentedControl
              options={GRAPHIC_OPTIONS}
              value={graphicStyle ?? ('' as GraphicVariant)}
              onChange={(v) => setGraphicStyle(graphicStyle === v ? null : v)}
              onLocked={onLocked}
            />
          </section>

          <div className="h-px bg-white/[0.08]" />

          {/* Caption Position */}
          <section>
            <h3 className="text-[length:var(--text-footnote)] font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Caption Position
            </h3>
            <SegmentedControl
              options={CAPTION_OPTIONS}
              value={captionStyle}
              onChange={setCaptionStyle}
              onLocked={onLocked}
            />
          </section>

          <div className="h-px bg-white/[0.08]" />

          {/* Audio Enhancement */}
          <section>
            <h3 className="text-[length:var(--text-footnote)] font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
              Audio Enhancement
            </h3>
            <div>
              {ENHANCE_OPTIONS.map((opt, i) => {
                const isActive = enhanceTier === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'relative w-full flex items-center gap-3 py-3 text-left transition-colors duration-150',
                      i < ENHANCE_OPTIONS.length - 1 && 'border-b border-white/[0.08]',
                      'rounded-lg px-2 -mx-2',
                      isActive ? 'bg-[--surface-selected]' : 'hover:bg-[--surface]',
                      opt.gate && isLocked(opt.gate) && 'opacity-40'
                    )}
                    onClick={() => (opt.gate && isLocked(opt.gate)) ? onLocked(opt.gate) : setEnhanceTier(opt.value)}
                  >
                    {/* Radio indicator */}
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
                      isActive ? 'border-white/70 bg-white/70' : 'border-white/[0.25]'
                    )}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[rgba(18,18,20)]" />}
                    </div>
                    <div>
                      <div className={cn(
                        'text-[length:var(--text-body-sm)] font-medium transition-colors duration-150',
                        isActive ? 'text-[--primary]' : 'text-[--secondary]'
                      )}>
                        {opt.label}
                      </div>
                      <div className="text-[length:var(--text-footnote)] text-[--tertiary]">
                        {opt.desc}
                      </div>
                    </div>
                    {opt.gate && isLocked(opt.gate) && (
                      <LockBadge
                        onClick={() => onLocked(opt.gate!)}
                        label={`${opt.label} requires Creator`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
