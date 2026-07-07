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
        className="rounded-t-chrome-sheet border-chrome-border bg-chrome-bg font-chrome gap-0"
      >
        <div className="flex justify-center pt-3 pb-1">
          <span className="w-9 h-1.5 rounded-chrome-full bg-chrome-text-placeholder/40" />
        </div>
        <div className="p-4 pt-2 space-y-2.5">
          <div className="rounded-chrome-input overflow-hidden bg-chrome-bg-sunken">
            {ROWS.map(({ label, sub, Icon, accept, capture }, i) => (
              <button
                key={label}
                type="button"
                onClick={() => openPicker(accept, capture)}
                className={cn(
                  'w-full flex items-center gap-4.5 px-5 py-3 text-left text-chrome-text-primary',
                  i < ROWS.length - 1 && 'border-b border-chrome-border'
                )}
              >
                <Icon size={26} className="shrink-0" />
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{label}</span>
                  <span className="text-[15px] text-chrome-text-secondary">{sub}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 rounded-chrome-input bg-chrome-bg-sunken text-chrome-text-primary text-lg font-semibold"
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
