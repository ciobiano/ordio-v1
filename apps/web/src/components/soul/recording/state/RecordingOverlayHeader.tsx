'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { roundIconBtn } from '@/lib/variants';

type RecordingOverlayHeaderProps = {
  onCancel: () => void;
};

export function RecordingOverlayHeader({ onCancel }: RecordingOverlayHeaderProps) {
  return (
    <div className="absolute left-4 top-4 safe-pt">
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        aria-label="Cancel recording"
        className={`${roundIconBtn({ intent: 'nav' })} mobile-glass-button text-white/70 hover:bg-white/10 hover:text-white`}
      >
        <Image
          src="/icons/arrow-left.svg"
          width={16}
          height={16}
          alt=""
          aria-hidden="true"
          className="invert"
        />
      </Button>
    </div>
  );
}

