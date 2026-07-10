'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';

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
    <header
      className="fixed left-0 right-0 z-30 flex items-center justify-between px-3 py-3"
      style={{
        top: 'env(safe-area-inset-top)',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Back"
        className="h-11 w-11 bg-white/10 text-white hover:bg-white/20 active:scale-[0.97]"
      >
        <Image
          src="/icons/arrow-left.svg"
          width={18}
          height={18}
          alt=""
          aria-hidden="true"
          className="invert"
        />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="xl"
        onClick={exportedUrl ? onDownload : onExport}
        disabled={exportDisabled && !exportedUrl}
        aria-label={exportedUrl ? 'Download' : 'Export'}
        className="text-[17px] font-semibold text-white
                   hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed
                   active:scale-[0.97]"
      >
        {exportedUrl ? 'Download' : 'Export'}
      </Button>
    </header>
  );
}
