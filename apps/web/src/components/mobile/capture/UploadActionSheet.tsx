'use client';

import type { RefObject } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Image01Icon, Video01Icon, File01Icon } from '@hugeicons/core-free-icons';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { FILE_ACCEPT_ATTRIBUTE } from '@/lib/fileValidation';

interface UploadActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

// Imported, never hand-written. This file used to carry its own copy of the
// accept list, and because openPicker below assigns `input.accept` directly the
// copy always won over the JSX value on the input itself — so a format missing
// here was greyed out in the OS picker no matter what validateFile() allowed.
// mp3 was missing. See the note on FILE_ACCEPT_ATTRIBUTE.

// Row layout follows the ChatGPT iOS Design System's "Attach menu" component: left icon,
// stacked title (18px/600) + subtitle (15px, secondary gray #8E8E93), 12px vertical padding.
//
// Known platform limitation (not fixable in code): 'Photo Library' and
// 'Choose File' both omit `capture`, so on iOS Safari tapping either always
// surfaces a second, native OS chooser (Take Photo or Video / Photo Library /
// Browse) — WebKit has no accept/capture combination that means "library or
// files only, skip the camera option." Only 'Take Video' (capture:
// 'environment') goes straight to the camera with no second sheet.
const ROWS = [
  { label: 'Photo Library', sub: 'Choose from your library', icon: Image01Icon, accept: 'video/*,image/*' as const },
  { label: 'Take Video', sub: 'Record a new video', icon: Video01Icon, accept: 'video/*' as const, capture: 'environment' },
  { label: 'Choose File', sub: 'Browse audio or video files', icon: File01Icon, accept: FILE_ACCEPT_ATTRIBUTE },
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
          {ROWS.map(({ label, sub, icon, accept, capture }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => openPicker(accept, capture)}
              className={cn(
                'w-full flex items-center gap-4.5 px-5 py-3 text-left text-white',
                i < ROWS.length - 1 && 'border-b border-white/10'
              )}
            >
              <HugeiconsIcon icon={icon} size={26} strokeWidth={2} className="shrink-0" />
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
