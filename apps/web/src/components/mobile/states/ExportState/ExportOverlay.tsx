'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  PencilEdit02Icon,
  PlayIcon,
  Share08Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import type { Word } from '@Ordio/shared/schemas'
import { OrdioMark } from '@/components/ui/OrdioMark'
import { DangerBadge } from '@/components/ui/SheetGlyphs'
import { fileExtension } from '@/hooks/video/useVideoExporter'
import { captureNavBtn, captureRoundBtn, sheetButton } from '@/lib/variants'
import { cn } from '@/lib/utils'
import type { FormatVariant } from '@/stores'

interface ExporterState {
  isExporting: boolean
  exportProgress: number
  exportedUrl: string | null
  exportMimeType?: string | null
  error: string | null
  cancelExport: () => void
}

interface ExportOverlayProps {
  open: boolean
  exporter: ExporterState
  transcript: Word[]
  durationSeconds: number
  format: FormatVariant
  onDownload: () => void
  onClose: () => void
}

const ASPECT: Record<FormatVariant, string> = {
  vertical: 'aspect-[9/16]',
  square: 'aspect-square',
  horizontal: 'aspect-video',
  instagram: 'aspect-[4/5]',
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-full bg-acid-text-1/8 px-3 font-acid-mono text-xs tracking-widest text-acid-text-2">
      {children}
    </div>
  )
}

function DockSlot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 short:gap-1.5">
      {children}
      <span className="text-xs text-acid-text-3" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

/**
 * Time left, from how long the export has taken so far. Only shown once there
 * is enough progress for the rate to mean something; before that it would
 * swing from "an hour" to "two seconds" in the first second.
 */
function useTimeLeft(isExporting: boolean, progress: number): string | null {
  const startedAt = useRef<number | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    if (!isExporting) {
      startedAt.current = null
      return
    }
    startedAt.current = Date.now()
    const timer = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [isExporting])

  if (!isExporting || startedAt.current === null || progress < 8 || progress >= 100) return null
  const elapsed = (Date.now() - startedAt.current) / 1000
  const remaining = (elapsed * (100 - progress)) / progress
  return `About ${clock(remaining)} left`
}

function Exporting({ progress, timeLeft, onCancel }: { progress: number; timeLeft: string | null; onCancel: () => void }) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-center">
        <StatusPill>
          <OrdioMark motion="pulse" size={30} />
          EXPORTING
        </StatusPill>
      </header>

      <div className="flex flex-col items-center gap-1.5 pt-6 short:pt-2">
        <span
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
          className="font-acid-mono text-6xl leading-none tracking-tighter text-acid-text-1 tabular-nums short:text-5xl"
        >
          {progress}
          <span className="text-acid-text-3">%</span>
        </span>
        <span className="text-sm text-acid-text-3">
          {timeLeft ? `${timeLeft} · keep this tab open` : 'Keep this tab open'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <OrdioMark motion="pulse" size={170} className="text-acid-text-1 short:h-auto short:w-36" />
        <div className="h-1.5 w-full max-w-70 overflow-hidden rounded-full bg-acid-text-1/8" aria-hidden="true">
          <div className="h-full rounded-full bg-acid-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
        <p className="m-0 max-w-70 text-center text-[13px] leading-normal text-acid-text-3">
          Your video is being made right here on this device.
        </p>
      </div>

      <div className="flex shrink-0 justify-center pt-5 short:pt-3">
        <DockSlot label="Cancel">
          <button type="button" onClick={onCancel} className={captureRoundBtn({ size: 'lg' })} aria-label="Cancel export">
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
          </button>
        </DockSlot>
      </div>
    </>
  )
}

function Ready({
  url,
  mimeType,
  format,
  durationSeconds,
  captionText,
  onDownload,
  onClose,
}: {
  url: string
  mimeType: string
  format: FormatVariant
  durationSeconds: number
  captionText: string
  onDownload: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [size, setSize] = useState<string | null>(null)
  const [bytes, setBytes] = useState<number | null>(null)

  // The finished file is a blob URL already in memory; reading it back for its
  // size costs nothing and makes the File field a fact rather than a guess.
  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        if (!cancelled) setBytes(blob.size)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [url])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionText)
      toast.success('Caption copied')
    } catch {
      toast.error('Could not copy — your browser blocked the clipboard')
    }
  }

  // Share the file itself where the platform can (iOS and Android share
  // sheets); anywhere else, saving it is the honest fallback.
  const share = async () => {
    try {
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], `ordio-video.${fileExtension(mimeType)}`, { type: mimeType })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: captionText || undefined })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
    onDownload()
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between">
        <button type="button" onClick={onClose} className={captureNavBtn} aria-label="Close">
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>
        <StatusPill>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6.5l2.2 2.2L9.5 3.5" className="stroke-acid-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          READY · {clock(durationSeconds)}
        </StatusPill>
        <span className="w-11" aria-hidden="true" />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center pt-3">
        <div
          className={cn(
            'relative max-h-full max-w-full overflow-hidden rounded-[22px] border border-acid-text-1/12 bg-acid-bg-subtle shadow-[0_30px_80px_rgb(0_0_0/0.6)]',
            ASPECT[format],
            format === 'horizontal' ? 'w-full' : 'h-full'
          )}
        >
          <video
            ref={videoRef}
            src={url}
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              if (v.videoWidth && v.videoHeight) setSize(`${v.videoWidth}×${v.videoHeight}`)
            }}
            onClick={togglePlay}
          />
          {!playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play preview"
              className="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-acid-bg-base/55 text-acid-text-1"
            >
              <HugeiconsIcon icon={PlayIcon} size={20} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <h1 className="m-0 mt-5 shrink-0 text-center text-[30px] font-bold tracking-[-0.03em] text-acid-text-1 short:mt-3 short:text-[26px]">
        Ready to <span className="font-acid-serif text-[1.2em] font-normal italic">post</span>
      </h1>

      <dl className="m-0 mt-4 grid shrink-0 grid-cols-3 gap-2 rounded-[22px] border border-acid-border-subtle bg-acid-bg-subtle px-4.5 py-3.5 short:mt-3 short:py-3">
        {[
          ['Size', size ?? '—'],
          ['Length', clock(durationSeconds)],
          ['File', bytes === null ? '—' : `${formatBytes(bytes)} ${fileExtension(mimeType).toUpperCase()}`],
        ].map(([term, value]) => (
          <div key={term} className="flex min-w-0 flex-col gap-1">
            <dt className="text-[11px] text-acid-text-3">{term}</dt>
            <dd className="m-0 truncate font-acid-mono text-sm text-acid-text-1">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex shrink-0 justify-between px-7 pt-5 pb-4 short:pt-3 short:pb-3">
        <DockSlot label="Save">
          <button type="button" onClick={onDownload} className={captureRoundBtn({ size: 'lg' })} aria-label="Save video">
            <HugeiconsIcon icon={Download04Icon} size={20} strokeWidth={1.8} />
          </button>
        </DockSlot>
        <DockSlot label="Copy caption">
          <button
            type="button"
            onClick={() => void copyCaption()}
            disabled={!captionText}
            className={cn(captureRoundBtn({ size: 'lg' }), 'disabled:opacity-40')}
            aria-label="Copy caption text"
          >
            <HugeiconsIcon icon={Copy01Icon} size={20} strokeWidth={1.8} />
          </button>
        </DockSlot>
        <DockSlot label="Edit">
          <button type="button" onClick={onClose} className={captureRoundBtn({ size: 'lg' })} aria-label="Back to editing">
            <HugeiconsIcon icon={PencilEdit02Icon} size={20} strokeWidth={1.8} />
          </button>
        </DockSlot>
      </div>

      <button type="button" onClick={() => void share()} className={cn(sheetButton({ tone: 'primary' }), 'h-13.5 shrink-0 rounded-[16px] text-base')}>
        <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={2} />
        Share video
      </button>
    </>
  )
}

/**
 * Export, as its own screen rather than a card over the editor.
 *
 * Exporting takes the capture screen's frame — status pill, big percentage,
 * the Ordio mark pulsing — so the app has one way of saying "working". Once
 * the file exists it becomes the Ready screen: the real exported video playing
 * in its own aspect ratio, its measured size and length, and the three things
 * people do next (save it, copy the caption for the post, go back and tweak)
 * with Share as the one lime commit.
 *
 * While exporting, the only exit is Cancel — the render would otherwise keep
 * running invisibly behind the editor.
 */
export function ExportOverlay({
  open,
  exporter,
  transcript,
  durationSeconds,
  format,
  onDownload,
  onClose,
}: ExportOverlayProps) {
  const progress = Math.max(0, Math.min(100, Math.round(exporter.exportProgress)))
  const timeLeft = useTimeLeft(exporter.isExporting, progress)
  const showReady = exporter.exportedUrl !== null && !exporter.isExporting && !exporter.error
  const captionText = transcript.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim()

  const handleCancel = () => {
    exporter.cancelExport()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-acid-bg-base"
          role="dialog"
          aria-modal="true"
          aria-label="Export"
        >
          <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pt-[max(0px,env(safe-area-inset-top))] safe-pb-dock">
            {exporter.isExporting && <Exporting progress={progress} timeLeft={timeLeft} onCancel={handleCancel} />}

            {exporter.error && !exporter.isExporting && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <DangerBadge kind="alert" />
                <h1 className="m-0 text-[17px] font-semibold text-acid-text-1">The export stopped</h1>
                <p role="alert" className="m-0 max-w-75 text-[13px] leading-normal text-acid-text-3">
                  {exporter.error}
                </p>
                <button type="button" onClick={onClose} className={cn(sheetButton({ tone: 'secondary' }), 'mt-2 max-w-60')}>
                  Back to editing
                </button>
              </div>
            )}

            {showReady && exporter.exportedUrl && (
              <Ready
                url={exporter.exportedUrl}
                mimeType={exporter.exportMimeType ?? 'video/webm'}
                format={format}
                durationSeconds={durationSeconds}
                captionText={captionText}
                onDownload={onDownload}
                onClose={onClose}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
