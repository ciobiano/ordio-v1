'use client'

import Image from 'next/image'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

interface ExportHeaderProps {
  exportedUrl: string | null
  exportDisabled: boolean
  onBack: () => void
  onExport: () => void
  onDownload: () => void
}

export function ExportHeader({
  exportedUrl,
  exportDisabled,
  onBack,
  onExport,
  onDownload,
}: ExportHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Back — discard changes"
        className="text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Image src="/icons/arrow-left.svg" width={16} height={16} alt="" aria-hidden="true" className="invert" />
      </Button>

      <span className="text-foreground text-sm font-medium tracking-tight">
        Edit
      </span>

      <div className="flex items-center gap-2">
        <UserButton />
        <Button
          type="button"
          onClick={exportedUrl ? onDownload : onExport}
          disabled={exportDisabled && !exportedUrl}
          aria-label={exportedUrl ? 'Download exported video' : 'Export video'}
          className="rounded-full px-4 h-9 text-sm font-semibold"
        >
          {exportedUrl ? 'Download' : 'Export'}
        </Button>
      </div>
    </header>
  )
}
