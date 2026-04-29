'use client'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface ExporterState {
  isExporting: boolean
  exportProgress: number
  exportedUrl: string | null
  error: string | null
  cancelExport: () => void
}

interface ExportFooterProps {
  trimIsEmpty: boolean
  exporter: ExporterState
  onDownload: () => void
}

export function ExportFooter({ trimIsEmpty, exporter, onDownload }: ExportFooterProps) {
  const progressPct = Math.round(exporter.exportProgress)

  return (
    <div className="px-3 pb-3 md:px-6 shrink-0">
      {trimIsEmpty && (
        <p role="alert" className="text-center text-[length:var(--text-callout)] text-destructive/70 pb-2">
          No audio remaining — adjust trim handles to continue
        </p>
      )}

      {(exporter.isExporting || exporter.error || exporter.exportedUrl) && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="bg-[color:var(--glass-bg)] backdrop-blur-xl rounded-2xl px-4 py-3">
            {exporter.isExporting && (
              <div
                className="flex flex-col gap-2"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Export progress"
              >
                <Progress value={progressPct} className="h-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[length:var(--text-caption)] text-white/50">
                    Exporting&nbsp;{progressPct}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exporter.cancelExport}
                    className="h-auto px-1 py-0 text-[length:var(--text-caption)] text-white/50 hover:text-white transition-colors duration-150 motion-reduce:transition-none"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {exporter.error && (
              <p role="alert" className="text-[length:var(--text-callout)] text-red-300/90">
                {exporter.error}
              </p>
            )}

            {exporter.exportedUrl && !exporter.isExporting && (
              <Button
                type="button"
                onClick={onDownload}
                className="h-11 w-full rounded-xl bg-white text-slate-950 hover:bg-white/90
                           transition-all duration-150 motion-reduce:transition-none
                           active:scale-[0.98] font-medium text-[length:var(--text-body)]"
              >
                Download export
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
