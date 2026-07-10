// apps/web/src/components/soul/export/ExportHeader.tsx
'use client';

import { ArrowLeft } from 'griddy-icons';
import { captureNavBtn } from '@/lib/variants';
import type { ExportPhase } from './types';

interface ExportHeaderProps {
  phase: ExportPhase;
  onBack: () => void;
}

const TITLE: Record<ExportPhase, string> = {
  preview: 'Preview',
  exporting: 'Exporting…',
  done: 'Ready to share',
};

export function ExportHeader({ phase, onBack }: ExportHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4.5 z-20">
      <button type="button" onClick={onBack} className={captureNavBtn} aria-label="Back">
        <ArrowLeft size={15} />
      </button>
      <span className="text-white/60 text-[15px] font-medium">{TITLE[phase]}</span>
      <div className="w-9 h-9" />
    </div>
  );
}
