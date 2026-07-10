// apps/web/src/components/soul/export/ExportDock.tsx
'use client';

import { Settings, Edit, Refresh, Close } from 'griddy-icons';
import { cn } from '@/lib/utils';
import { exportCenterSlot, captureRoundBtn } from '@/lib/variants';
import type { ExportPhase } from './types';

interface ExportDockProps {
  phase: ExportPhase;
  progress: number;
  exportDisabled: boolean;
  onOpenStyle: () => void;
  onOpenEdit: () => void;
  onExport: () => void;
  onDownload: () => void;
  onCancelExport: () => void;
  onReset: () => void;
}

export function ExportDock({
  phase,
  progress,
  exportDisabled,
  onOpenStyle,
  onOpenEdit,
  onExport,
  onDownload,
  onCancelExport,
  onReset,
}: ExportDockProps) {
  return (
    <div className="absolute left-0 right-0 bottom-0 px-5 pb-10 z-20">
      <div className="flex items-center gap-3 w-full min-h-15">
        {phase !== 'exporting' && (
          <button
            type="button"
            onClick={phase === 'done' ? onReset : onOpenStyle}
            className={captureRoundBtn({ tone: 'neutral' })}
            aria-label={phase === 'done' ? 'Start a new recording' : 'Style'}
          >
            {phase === 'done' ? <Refresh size={18} /> : <Settings size={20} />}
          </button>
        )}

        <button
          type="button"
          onClick={phase === 'preview' ? onExport : phase === 'done' ? onDownload : undefined}
          disabled={phase === 'preview' && exportDisabled}
          className={cn(exportCenterSlot({ phase }))}
          aria-label={phase === 'preview' ? 'Export video' : phase === 'done' ? 'Download' : undefined}
        >
          {phase === 'preview' && (
            <span className="text-black font-semibold text-base whitespace-nowrap">Export video</span>
          )}
          {phase === 'done' && (
            <span className="text-black font-semibold text-base whitespace-nowrap">Download</span>
          )}
          {phase === 'exporting' && (
            <span
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-[width] duration-120 ease-linear"
              style={{ width: `${Math.round(progress)}%` }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={phase === 'exporting' ? onCancelExport : onOpenEdit}
          className={captureRoundBtn({ tone: phase === 'exporting' ? 'danger' : 'neutral' })}
          aria-label={phase === 'exporting' ? 'Cancel export' : 'Edit'}
        >
          {phase === 'exporting' ? <Close size={18} /> : <Edit size={18} />}
        </button>
      </div>
    </div>
  );
}
