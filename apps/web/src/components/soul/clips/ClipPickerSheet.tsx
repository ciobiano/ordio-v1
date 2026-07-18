'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { toast } from 'sonner';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { extractWindow } from '@Ordio/engine/media/extractWindow';
import { audioBufferToWavBlob } from '@Ordio/engine/media/whisperAudio';

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

/** Words inside [start,end], re-based to clip-relative time. */
export function windowTranscript(words: Word[], start: number, end: number): Word[] {
  return words
    .filter((w) => w.start >= start && w.end <= end)
    .map((w) => ({ text: w.text, start: w.start - start, end: w.end - start }));
}

export function ClipPickerSheet({
  isOpen, candidates, episodeFile, episodeWords, onClose, onPicked,
}: ClipPickerSheetProps) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);

  const pick = async (candidate: ClipCandidate, index: number) => {
    if (!episodeFile || pickingIndex !== null) return;
    setPickingIndex(index);
    try {
      const buffer = await extractWindow(episodeFile, candidate.start, candidate.end);
      const blob = audioBufferToWavBlob(buffer);

      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error('Clip upload failed');
      const { storageId } = (await uploadRes.json()) as { storageId: string };

      const sessionId = await createSession({
        storageId: storageId as GenericId<'_storage'>,
        mimeType: 'audio/wav',
        durationSec: candidate.end - candidate.start,
        transcript: windowTranscript(episodeWords, candidate.start, candidate.end),
      });
      onPicked(sessionId);
    } catch (err) {
      console.error('[ClipPickerSheet]', err);
      toast.error('Could not prepare this clip. Try another one.');
      setPickingIndex(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && pickingIndex === null && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-auto max-h-[85vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="rounded-[28px] overflow-hidden bg-[#0d0d10] px-5 py-4">
          <h2 className="text-lg font-semibold text-white mb-1">Best moments</h2>
          <p className="text-[15px] text-white/45 mb-3">
            Ordio found {candidates.length === 1 ? 'this moment' : `${candidates.length} moments`} worth clipping
          </p>
          <ul className="flex flex-col gap-2.5">
            {candidates.map((c, i) => (
              <li key={`${c.start}-${c.end}`}>
                <button
                  type="button"
                  disabled={pickingIndex !== null || !episodeFile}
                  onClick={() => pick(c, i)}
                  className={cn(
                    'w-full text-left rounded-2xl border border-white/10 bg-white/4 px-4 py-3',
                    'active:bg-white/8 disabled:opacity-50'
                  )}
                >
                  <span className="block text-[13px] font-medium text-white/45">
                    {formatTime(c.start)} – {formatTime(c.end)}
                  </span>
                  <span className="block text-[15px] text-white mt-1 line-clamp-2">
                    &ldquo;{c.hookText}&rdquo;
                  </span>
                  <span className="block text-[13px] text-white/45 mt-1">
                    {pickingIndex === i ? 'Preparing clip…' : c.rationale}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pickingIndex !== null}
          className="w-full mt-2.5 py-4 rounded-[28px] bg-white/6 border border-white/14 text-white text-lg font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}
