'use client'

interface ExportFooterProps {
  trimIsEmpty: boolean
}

/**
 * Inline footer under the editor. Export progress and the finished share card
 * moved to ExportOverlay (centered dialog) — this only carries the trim-empty
 * warning now.
 */
export function ExportFooter({ trimIsEmpty }: ExportFooterProps) {
  if (!trimIsEmpty) return null

  return (
    <div className="px-3 pb-3 md:px-6 shrink-0">
      <p role="alert" className="text-center text-[length:var(--text-callout)] text-destructive/70 pb-2">
        No audio remaining — adjust trim handles to continue
      </p>
    </div>
  )
}
