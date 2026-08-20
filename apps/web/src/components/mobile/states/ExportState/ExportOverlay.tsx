'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Word } from '@Ordio/shared/schemas'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ShareCard, type ShareCardVariant } from './ShareCard'
import { acidPill } from '@/lib/variants'

interface ExporterState {
  isExporting: boolean
  exportProgress: number
  exportedUrl: string | null
  error: string | null
  cancelExport: () => void
}

interface ExportOverlayProps {
  open: boolean
  exporter: ExporterState
  transcript: Word[]
  durationSeconds: number
  onDownload: () => void
  onClose: () => void
}

const VARIANTS: ShareCardVariant[] = ['acid', 'sunset', 'electric']

function headlineFromTranscript(transcript: Word[] | undefined): string {
  if (!transcript || transcript.length === 0) return 'Say it out loud.'
  return transcript
    .slice(0, 8)
    .map((w) => w.text)
    .join(' ')
    .trim()
}

/**
 * Centered export dialog over a blurred stage. Replaces the old in-flow footer
 * card, which sank below the fold whenever the canvas morphed to a tall aspect
 * ratio. Export progress, errors, and the finished share card all live here —
 * one flow, one surface. While exporting, the only way out is Cancel (explicit
 * state exit back to the editor); the backdrop is intentionally inert.
 */
export function ExportOverlay({
  open,
  exporter,
  transcript,
  durationSeconds,
  onDownload,
  onClose,
}: ExportOverlayProps) {
  const [variant, setVariant] = useState<ShareCardVariant>('acid')
  const progressPct = Math.round(exporter.exportProgress)
  const showSuccess = exporter.exportedUrl !== null && !exporter.isExporting && !exporter.error

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xl px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Export"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="w-full max-w-[340px] rounded-3xl border border-acid-border-subtle bg-acid-surface-1 p-6"
          >
            {exporter.isExporting && (
              <div
                className="flex flex-col items-center gap-5"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Export progress"
              >
                <span className="text-[2.5rem] font-bold tabular-nums text-acid-text-1 leading-none">
                  {progressPct}%
                </span>
                <Progress value={progressPct} className="h-1 w-full" />
                <span className="text-[length:var(--text-caption)] text-acid-text-3">
                  Creating your video…
                </span>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-11 w-full rounded-xl text-acid-text-2 hover:text-acid-text-1"
                >
                  Cancel
                </Button>
              </div>
            )}

            {exporter.error && !exporter.isExporting && (
              <div className="flex flex-col gap-4">
                <p role="alert" className="text-acid-label text-red-300/90">
                  {exporter.error}
                </p>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="h-11 w-full rounded-xl text-acid-text-2 hover:text-acid-text-1"
                >
                  Close
                </Button>
              </div>
            )}

            {showSuccess && (
              <div className="flex flex-col gap-4">
                <div className="mx-auto w-full max-w-[220px]">
                  <ShareCard
                    headline={headlineFromTranscript(transcript)}
                    durationSeconds={durationSeconds}
                    variant={variant}
                  />
                </div>

                <div
                  className="flex gap-1.5 rounded-acid-md bg-acid-surface-2 p-1"
                  role="tablist"
                  aria-label="Share card color"
                >
                  {VARIANTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={variant === v}
                      onClick={() => setVariant(v)}
                      className={acidPill({ active: variant === v })}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  onClick={onDownload}
                  className="h-11 w-full rounded-xl bg-acid-accent text-acid-on-accent hover:brightness-105
                             transition-all duration-150 motion-reduce:transition-none
                             active:scale-[0.98] font-semibold text-[length:var(--text-body)]"
                >
                  Save video
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="h-11 w-full rounded-xl text-acid-text-2 hover:text-acid-text-1"
                >
                  Done
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
