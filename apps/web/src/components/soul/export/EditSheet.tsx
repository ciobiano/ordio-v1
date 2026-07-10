// apps/web/src/components/soul/export/EditSheet.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import CaptionEditor from '@/components/soul/captions/CaptionEditor';
import { TrimPanel } from '@/components/soul/editor/TrimPanel';
import FormatToggle from '@/components/soul/shared/FormatToggle';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import type { UseTrimHistoryReturn } from './useTrimHistory';
import type { FeatureKey } from '@/lib/featureGates';

interface EditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playback: UsePlaybackReturn;
  trimmer: UseAudioTrimmerReturn;
  audioBuffer: AudioBuffer | null;
  history: UseTrimHistoryReturn;
  onLocked: (feature: FeatureKey) => void;
}

export function EditSheet({ isOpen, onClose, playback, trimmer, audioBuffer, history, onLocked }: EditSheetProps) {
  const [tab, setTab] = useState<'trim' | 'captions' | 'format'>('trim');

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-[70vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="flex flex-col h-full rounded-[28px] overflow-hidden bg-[#0d0d10]">
          <div className="flex gap-1.5 p-2.5 shrink-0">
            {(['trim', 'captions', 'format'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 h-9 rounded-full text-[13px] font-semibold text-white/60',
                  tab === t && 'bg-white/12 text-white'
                )}
              >
                {t === 'trim' ? 'Trim' : t === 'captions' ? 'Captions' : 'Reframe'}
              </button>
            ))}
          </div>

          {tab === 'captions' ? (
            <div className="flex-1 min-h-0 px-4 pb-4">
              <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-4 pb-4">
                {tab === 'trim' && (
                  <TrimPanel
                    audioBuffer={audioBuffer}
                    trimmer={trimmer}
                    onCommit={history.commit}
                    onUndo={history.undo}
                    onRedo={history.redo}
                    canUndo={history.canUndo}
                    canRedo={history.canRedo}
                    onPreviewAt={playback.previewAt}
                  />
                )}
                {tab === 'format' && <FormatToggle onLocked={onLocked} />}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
