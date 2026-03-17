'use client';

import { useState } from 'react';

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
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between
                 min-h-11 px-4 py-2.5 bg-black border-b border-white/6"
    >
      <p className="text-white/60 text-[length:var(--text-caption)] flex-1 text-center">{warnings[0]}</p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss warning"
        className="ml-4 text-white/50 hover:text-white/80 transition-colors duration-150
                   cursor-pointer shrink-0 p-1 rounded min-w-11 min-h-11 flex items-center justify-center"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M1 1l12 12M13 1L1 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
