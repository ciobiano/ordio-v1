'use client';

import type { RefObject } from 'react';
import { Image as ImageIcon, VideoCamera, File as FileIcon } from 'griddy-icons';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface UploadActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

const ACCEPT_AUDIO_VIDEO =
  'audio/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4a';

// Row layout follows the ChatGPT iOS Design System's "Attach menu" component: left icon,
// stacked title (18px/600) + subtitle (15px, secondary gray #8E8E93), 12px vertical padding.
const ROWS = [
  { label: 'Photo Library', sub: 'Choose from your library', Icon: ImageIcon, accept: 'video/*,image/*' as const },
  { label: 'Take Video', sub: 'Record a new video', Icon: VideoCamera, accept: 'video/*' as const, capture: 'environment' },
  { label: 'Choose File', sub: 'Browse audio or video files', Icon: FileIcon, accept: ACCEPT_AUDIO_VIDEO },
];

export function UploadActionSheet({ isOpen, onClose, fileInputRef }: UploadActionSheetProps) {
  const openPicker = (accept: string, capture?: string) => {
    const input = fileInputRef.current;
    if (input) {
      input.accept = accept;
      if (capture) input.setAttribute('capture', capture);
      else input.removeAttribute('capture');
      input.click();
    }
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-auto max-h-[85vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="rounded-[28px] overflow-hidden bg-[#0d0d10]">
          {ROWS.map(({ label, sub, Icon, accept, capture }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => openPicker(accept, capture)}
              className={cn(
                'w-full flex items-center gap-4.5 px-5 py-3 text-left text-white',
                i < ROWS.length - 1 && 'border-b border-white/10'
              )}
            >
              <Icon size={26} className="shrink-0" />
              <span className="flex flex-col">
                <span className="text-lg font-semibold">{label}</span>
                <span className="text-[15px] text-white/45">{sub}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2.5 py-4 rounded-[28px] bg-white/6 border border-white/14 text-white text-lg font-semibold"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}
