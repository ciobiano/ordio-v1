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
    <div className="px-4 md:px-6 shrink-0">
      {trimIsEmpty && (
        <p role="alert" className="text-center text-sm text-destructive/70 pb-2">
          No audio remaining — adjust trim handles to continue
        </p>
      )}

      {exporter.isExporting && (
        <div
          className="mb-4 flex flex-col gap-2"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <Progress value={progressPct} className="h-0.75" />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Exporting&nbsp;{progressPct}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={exporter.cancelExport}
              className="text-muted-foreground text-xs hover:text-foreground h-auto py-0 px-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {exporter.error && (
        <p role="alert" className="text-destructive text-sm text-center pb-3">
          {exporter.error}
        </p>
      )}

      {/* TODO(human): Export success / download section
          When exporter.exportedUrl is set, the video is ready.
          Implement the export success UI here — consider:
          - A success message + download button
          - Should it replace the panel below or appear inline?
          - Should the download be prominent (full-width pill) or compact?
      */}
      {exporter.exportedUrl && (
        <div className="pb-6">
        </div>
      )}
    </div>
  )
}
