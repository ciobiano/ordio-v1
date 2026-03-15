'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { waveformSampler } from '@Ordio/shared/waveform'
import type { Word } from '@Ordio/shared/schemas'
import type { UseAudioTrimmerReturn } from '@/hooks/useAudioTrimmer'

interface TrimPanelProps {
  audioBuffer: AudioBuffer | null
  transcript: Word[]
  trimmer: UseAudioTrimmerReturn
  onSeek: (time: number) => void
}

export function TrimPanel({ audioBuffer, transcript, trimmer, onSeek }: TrimPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeHandle = useRef<'start' | 'end' | null>(null)

  const { trimState, setStartTime, setEndTime, toggleWordDeletion, clearDeletions } = trimmer
  const duration = audioBuffer?.duration ?? 0

  // Downsample audio for waveform visualization — waveformSampler accepts AudioData (AudioBuffer-compatible)
  const bars = useMemo(() => {
    if (!audioBuffer) return []
    return waveformSampler(audioBuffer, 100)
  }, [audioBuffer])

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || bars.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const barWidth = width / bars.length
    bars.forEach((amp, i) => {
      const barH = Math.max(1, amp * height * 0.8)
      const x = i * barWidth
      const y = (height - barH) / 2
      ctx.fillStyle = 'rgba(250, 248, 245, 0.4)'
      ctx.fillRect(x, y, barWidth - 1, barH)
    })

    // Darken trimmed regions
    const startX = (trimState.startTime / duration) * width
    const endX = (trimState.endTime / duration) * width

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, startX, height)
    ctx.fillRect(endX, 0, width - endX, height)
  }, [bars, trimState.startTime, trimState.endTime, duration])

  // Pointer handling for drag handles
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current || duration === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = x / rect.width

      const startPct = trimState.startTime / duration
      const endPct = trimState.endTime / duration

      if (Math.abs(pct - startPct) < Math.abs(pct - endPct)) {
        activeHandle.current = 'start'
      } else {
        activeHandle.current = 'end'
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [trimState.startTime, trimState.endTime, duration]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle.current || !containerRef.current || duration === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const time = pct * duration

      if (activeHandle.current === 'start') {
        setStartTime(Math.min(time, trimState.endTime - 0.1))
      } else {
        setEndTime(Math.max(time, trimState.startTime + 0.1))
      }
    },
    [duration, trimState.startTime, trimState.endTime, setStartTime, setEndTime]
  )

  const handlePointerUp = useCallback(() => {
    activeHandle.current = null
  }, [])

  const selectedCount = trimState.deletedWordIndices.size

  const formatTimestamp = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Timeline trim */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-[--secondary]">Timeline</span>
          <span className="text-[10px] text-[--tertiary]">Drag handles to trim start/end</span>
        </div>

        <div
          ref={containerRef}
          className="relative h-12 bg-[--surface] rounded-lg cursor-ew-resize touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={48}
            className="w-full h-full rounded-lg"
          />

          {/* Start handle — position is runtime-computed from trimState.startTime / duration */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-[--primary] rounded-sm cursor-ew-resize"
            style={{ left: `${(trimState.startTime / duration) * 100}%` }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>

          {/* End handle — position is runtime-computed from trimState.endTime / duration */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-[--primary] rounded-sm cursor-ew-resize"
            style={{ left: `${(trimState.endTime / duration) * 100}%`, transform: 'translateX(-100%)' }}
          >
            <div className="absolute inset-y-1/3 left-0.5 w-px bg-black/30" />
          </div>
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[--tertiary] font-mono">
            {formatTimestamp(trimState.startTime)}
          </span>
          <span className="text-[10px] text-[--tertiary] font-mono">
            {formatTimestamp(trimState.endTime)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[--border]" />

      {/* Section 2: Word removal */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-[--secondary]">Remove words</span>
          <span className="text-[10px] text-[--tertiary]">Tap words to select</span>
        </div>

        {/* Word chips */}
        <div className="flex flex-wrap gap-1.5">
          {transcript.map((word, i) => {
            const isDeleted = trimState.deletedWordIndices.has(i)
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs transition-colors',
                  isDeleted
                    ? 'bg-[rgba(225,29,72,0.12)] border border-[rgba(225,29,72,0.3)] text-destructive line-through opacity-50'
                    : 'bg-[--surface] text-[--secondary] hover:bg-[--surface-hover]'
                )}
                onClick={() => toggleWordDeletion(i)}
              >
                {word.text}
              </button>
            )
          })}
        </div>

        {/* Action bar (visible when words are selected) */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[--border]">
            <span className="text-xs text-destructive/60">
              {selectedCount} word{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-[--secondary] hover:text-[--primary] transition-colors"
                onClick={clearDeletions}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs text-destructive bg-[rgba(225,29,72,0.12)] px-3 py-1 rounded-md hover:bg-[rgba(225,29,72,0.2)] transition-colors"
                onClick={() => {
                  // Words are already tracked in deletedWordIndices — "Remove" is a visual confirmation
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
