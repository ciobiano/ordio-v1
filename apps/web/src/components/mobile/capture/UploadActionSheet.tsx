'use client';

import type { RefObject } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Image01Icon, Video01Icon, File01Icon } from '@hugeicons/core-free-icons';
import { OrdSheet } from '@/components/ui/OrdSheet';
import { sheetButton, sheetOption } from '@/lib/variants';
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
    <OrdSheet
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Add a recording"
      description="Audio or video from your phone"
      footer={
        <button type="button" onClick={onClose} className={sheetButton({ tone: 'secondary' })}>
          Cancel
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        {ROWS.map(({ label, sub, icon, accept, capture }) => (
          <button
            key={label}
            type="button"
            onClick={() => openPicker(accept, capture)}
            className={sheetOption({ selected: false })}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-acid-text-1/8 text-acid-text-1">
              <HugeiconsIcon icon={icon} size={20} strokeWidth={1.8} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-medium text-acid-text-1">{label}</span>
              <span className="text-[13px] text-acid-text-3">{sub}</span>
            </span>
          </button>
        ))}
      </div>
    </OrdSheet>
  );
}
