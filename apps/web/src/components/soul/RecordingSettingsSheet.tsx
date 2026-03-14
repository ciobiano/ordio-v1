'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
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
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [isOpen])

  // Drag-down to dismiss
  const dragStartY = useRef<number | null>(null)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY
  }, [])
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return
      const delta = e.clientY - dragStartY.current
      if (delta > 100) {
        dragStartY.current = null
        onClose()
      }
    },
    [onClose]
  )
  const handlePointerUp = useCallback(() => {
    dragStartY.current = null
  }, [])

  const handleOptionClick = useCallback(
    (gate: FeatureKey | undefined, action: () => void) => {
      if (gate) {
        onLocked(gate)
      } else {
        action()
      }
    },
    [onLocked]
  )

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
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#0a0a0a] border-t border-[--border] max-h-[70vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[--surface-hover]" />
        </div>

        <div className="px-5 pb-8 space-y-6">
          {/* Waveform Style */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Waveform Style
            </h3>
            <div className="flex flex-wrap gap-2">
              {WAVEFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-sm transition-colors',
                    waveformStyle === opt.value && graphicStyle === null
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => {
                      setWaveformStyle(opt.value)
                      setGraphicStyle(null)
                    })
                  }
                >
                  {opt.label}
                  {opt.gate && (
                    <LockBadge
                      onClick={() => onLocked(opt.gate!)}
                      label={`${opt.label} requires Creator`}
                    />
                  )}
                </button>
              ))}
            </div>
            {/* Graphic styles */}
            <div className="flex flex-wrap gap-2 mt-2">
              {GRAPHIC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm transition-colors',
                    graphicStyle === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    setGraphicStyle(graphicStyle === opt.value ? null : opt.value)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-[--border]" />

          {/* Caption Position */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Caption Position
            </h3>
            <div className="flex gap-2">
              {CAPTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-sm transition-colors',
                    captionStyle === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => setCaptionStyle(opt.value))
                  }
                >
                  {opt.label}
                  {opt.gate && (
                    <LockBadge
                      onClick={() => onLocked(opt.gate!)}
                      label={`${opt.label} captions require Creator`}
                    />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-[--border]" />

          {/* Audio Enhancement */}
          <section>
            <h3 className="text-xs font-medium text-[--secondary] uppercase tracking-wider mb-3">
              Audio Enhancement
            </h3>
            <div className="space-y-2">
              {ENHANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'relative w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    enhanceTier === opt.value
                      ? 'bg-[--surface-active] text-[--primary]'
                      : 'bg-[--surface] text-[--secondary]'
                  )}
                  onClick={() =>
                    handleOptionClick(opt.gate, () => setEnhanceTier(opt.value))
                  }
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      enhanceTier === opt.value ? 'border-[--primary]' : 'border-[--tertiary]'
                    )}
                  >
                    {enhanceTier === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-[--primary]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-[--tertiary]">{opt.desc}</div>
                  </div>
                  {opt.gate && (
                    <LockBadge
                      onClick={() => onLocked(opt.gate!)}
                      label={`${opt.label} requires Creator`}
                    />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
