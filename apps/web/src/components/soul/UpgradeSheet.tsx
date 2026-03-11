'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/cn';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { FeatureKey } from '@/lib/featureGates';

interface UpgradeSheetProps {
  open: boolean;
  onClose: () => void;
  feature?: FeatureKey;
  onSignIn?: () => void;
  onUpgrade?: () => void;
}

function featureLabel(feature: FeatureKey): string {
  const labels: Record<FeatureKey, string> = {
    enhance_clean: 'AI Noise Removal',
    enhance_hd: 'HD Remaster',
    waveform_circle: 'Circle Waveform',
    waveform_spectrogram: 'Spectrogram',
    font_poppins: 'Poppins',
    font_montserrat: 'Montserrat',
    font_space_grotesk: 'Space Grotesk',
    font_dm_sans: 'DM Sans',
    font_playfair: 'Playfair Display',
    format_vertical: '9:16 Vertical',
    format_horizontal: '16:9 Horizontal',
    format_instagram: '4:5 Instagram',
    caption_center: 'Center Captions',
    caption_karaoke: 'Karaoke Mode',
    unlimited_exports: 'Unlimited Exports',
  };
  return labels[feature];
}

export default function UpgradeSheet({ open, onClose, feature, onUpgrade }: UpgradeSheetProps) {
  const { isAuthenticated } = useCurrentUser();
  const { openSignIn } = useClerk();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isExportLimit = feature === undefined;

  const title = isExportLimit
    ? '3 free exports used today'
    : `${featureLabel(feature)} is a Creator feature`;

  const body = isExportLimit
    ? isAuthenticated
      ? 'Daily limit reached. Unlimited exports are coming with Creator.'
      : '3 free exports used today. Sign in to continue, or come back tomorrow.'
    : isAuthenticated
      ? 'Upgrade to Creator to unlock this feature.'
      : 'Sign in to get 3 more exports today. Unlock everything with Creator.';

  function handleSignIn() {
    onClose();
    openSignIn();
  }

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-sheet-title"
        className={cn(
          'fixed bottom-0 inset-x-0 z-50 px-4 pb-8 pt-6 flex flex-col items-center',
          'transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="w-full max-w-sm rounded-3xl bg-[#111] border border-white/[0.08] shadow-2xl px-6 py-6">
          <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-5" aria-hidden="true" />

          <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4 mx-auto">
            <svg className="w-4.5 h-4.5 text-white/60" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 7V5a3 3 0 016 0v2M4 7h8a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
              />
            </svg>
          </div>

          <h2
            id="upgrade-sheet-title"
            className="text-[0.9375rem] font-[600] text-white/90 text-center mb-2 leading-snug"
          >
            {title}
          </h2>

          <p className="text-[0.8125rem] text-white/50 text-center leading-relaxed mb-6">
            {body}
          </p>

          <div className="flex flex-col gap-2.5">
            {isAuthenticated && onUpgrade && (
              <button
                onClick={() => { onClose(); onUpgrade(); }}
                className="w-full py-3 rounded-full bg-white text-black text-[0.875rem] font-[600]
                           hover:bg-white/92 transition-all duration-200 cursor-pointer
                           hover:scale-[1.02] active:scale-[0.98]"
              >
                Upgrade to Creator — $9/mo
              </button>
            )}
            {!isAuthenticated && (
              <button
                onClick={handleSignIn}
                className="w-full py-3 rounded-full bg-white text-black text-[0.875rem] font-[600]
                           hover:bg-white/92 transition-all duration-200 cursor-pointer
                           hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign in
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-full text-white/60 text-[0.875rem] font-[500]
                         hover:text-white/80 transition-colors duration-150 cursor-pointer"
            >
              {isAuthenticated ? 'Maybe later' : 'Maybe later'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
