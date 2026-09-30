'use client';

import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { OrdSheet } from '@/components/ui/OrdSheet';
import { sheetButton, sheetOption } from '@/lib/variants';
import { cn } from '@/lib/utils';
import { useClipPicker } from '@/hooks/clips/useClipPicker';

interface ClipPickerSheetProps {
  isOpen: boolean;
  candidates: ClipCandidate[];
  episodeFile: File | null;
  episodeWords: Word[];
  onClose: () => void;
  onPicked: (sessionId: string) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ClipPickerSheet({
  isOpen, candidates, episodeFile, episodeWords, onClose, onPicked,
}: ClipPickerSheetProps) {
  const { pick, pickingIndex } = useClipPicker({ episodeFile, episodeWords, onPicked });

  const busy = pickingIndex !== null;

  return (
    <OrdSheet
      open={isOpen}
      onOpenChange={(open) => !open && !busy && onClose()}
      dismissible={!busy}
      title="Best moments"
      description={`Ordio found ${candidates.length === 1 ? 'this moment' : `${candidates.length} moments`} worth clipping`}
      footer={
        <button type="button" onClick={onClose} disabled={busy} className={sheetButton({ tone: 'secondary' })}>
          Cancel
        </button>
      }
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {candidates.map((c, i) => (
          <li key={`${c.start}-${c.end}`}>
            <button
              type="button"
              disabled={busy || !episodeFile}
              onClick={() => pick(c, i)}
              className={cn(sheetOption({ selected: pickingIndex === i }), 'flex-col items-start gap-1 disabled:opacity-50')}
            >
              <span className="font-acid-mono text-xs text-acid-text-3">
                {formatTime(c.start)} – {formatTime(c.end)}
              </span>
              <span className="line-clamp-2 text-[15px] text-acid-text-1">&ldquo;{c.hookText}&rdquo;</span>
              <span className="text-[13px] text-acid-text-3">
                {pickingIndex === i ? 'Preparing clip…' : c.rationale}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </OrdSheet>
  );
}
