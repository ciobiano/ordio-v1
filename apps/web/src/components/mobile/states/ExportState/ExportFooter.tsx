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
      {/*
        TODO(human): pick the ACID type role for this alert.

        `--text-callout` is referenced here but defined nowhere, so this line
        currently renders at whatever size it inherits. DESIGN.md §Type lists the
        real roles, each carrying its own leading and tracking as one triple:

          --text-acid-body      15 -> 17px   the size of ordinary prose
          --text-acid-label     13 -> 14px   the size of a control's name
          --text-acid-caption   12 -> 13px   secondary, below the main line
          --text-acid-footnote  11 -> 12px   the smallest thing we set

        Replace `var(--text-callout)` with your chosen role. It is a blocking
        warning ("No audio remaining") that must be noticed but sits under the
        editor, so the trade-off is being seen versus shouting.

        Do NOT add a `leading-*` or `tracking-*` alongside it — the acid tokens
        carry their own, and splitting the triple is what DESIGN.md forbids.
      */}
      <p role="alert" className="text-center text-[length:var(--text-callout)] text-destructive/70 pb-2">
        No audio remaining — adjust trim handles to continue
      </p>
    </div>
  )
}
