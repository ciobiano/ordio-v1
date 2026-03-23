'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'ordio_capability_warning_dismissed';

interface CapabilityBannerProps {
  warnings: string[];
}

export default function CapabilityBanner({ warnings }: CapabilityBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!sessionStorage.getItem(DISMISS_KEY);
  });

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  if (dismissed || warnings.length === 0) return null;

  return (
    <Alert className="fixed top-0 left-0 right-0 z-50 rounded-none border-x-0 border-t-0
                      border-b border-white/6 bg-black flex items-center justify-between
                      min-h-11 px-4 py-2.5">
      <AlertDescription className="text-white/60 text-xs flex-1 text-center">
        {warnings[0]}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label="Dismiss warning"
        className="ml-4 shrink-0 text-white/50 hover:text-white/80 hover:bg-transparent"
      >
        <Image src="/icons/close.svg" width={14} height={14} alt="" aria-hidden="true" className="invert opacity-50" />
      </Button>
    </Alert>
  );
}
