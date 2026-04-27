'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { primaryBtn } from '@/lib/variants';

interface ExportHeaderProps {
  exportedUrl: string | null;
  exportDisabled: boolean;
  onBack: () => void;
  onExport: () => void;
  onDownload: () => void;
}

export function ExportHeader({
  exportedUrl,
  exportDisabled,
  onBack,
  onExport,
  onDownload,
}: ExportHeaderProps) {
  return (
    <header className="mobile-glass sticky top-3 z-20 mx-3 mb-3 flex items-center justify-between rounded-[1.6rem] px-3 py-3 shrink-0 md:mx-6 md:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Back — discard changes"
        className="mobile-glass-button rounded-2xl text-white/78 hover:bg-white/10 hover:text-white"
      >
        <Image
          src="/icons/arrow-left.svg"
          width={16}
          height={16}
          alt=""
          aria-hidden="true"
          className="invert"
        />
      </Button>

      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/36">Ordio Studio</p>
        <span className="text-sm font-medium tracking-tight text-white">Edit</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={exportedUrl ? onDownload : onExport}
          disabled={exportDisabled && !exportedUrl}
          aria-label={exportedUrl ? 'Download exported video' : 'Export video'}
          className={cn(primaryBtn, 'h-11 w-auto rounded-2xl px-5 py-2 text-sm')}
        >
          {exportedUrl ? 'Download' : 'Export'}
        </Button>
      </div>
    </header>
  );
}
