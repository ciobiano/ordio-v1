'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { primaryBtn } from '@/lib/variants';
import { useCheckout } from '@/hooks/useCheckout';
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
  const { priceLabel } = useCheckout();

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
    ? 'Daily export limit reached'
    : `${featureLabel(feature)} is a Creator feature`;

  const body = isExportLimit
    ? 'Unlimited exports are included with Creator.'
    : 'Upgrade to Creator to unlock this feature.';

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
        <div className="w-full max-w-sm rounded-3xl bg-[--surface-glass-card] backdrop-blur-[40px] backdrop-saturate-[160%] border border-[--border-glass] shadow-2xl [box-shadow:var(--shadow-glass-top)] px-6 py-6">
          <div className="w-9 h-[5px] rounded-full bg-white/[0.25] mx-auto mb-5" aria-hidden="true" />

          <div className="w-10 h-10 rounded-full bg-[--surface] border border-[--border] flex items-center justify-center mb-4 mx-auto">
            <svg className="w-4.5 h-4.5 text-[--secondary]" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 7V5a3 3 0 016 0v2M4 7h8a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
              />
            </svg>
          </div>

          <h2
            id="upgrade-sheet-title"
            className="text-[length:var(--text-body)] font-semibold text-[--primary] text-center mb-2 leading-snug"
          >
            {title}
          </h2>

          <p className="text-[length:var(--text-caption)] text-[--secondary] text-center leading-relaxed mb-6">
            {body}
          </p>

          <div className="flex flex-col gap-2.5">
            {onUpgrade && (
              <button
                onClick={() => { onClose(); onUpgrade(); }}
                className={cn(primaryBtn, 'w-full')}
              >
                Upgrade to Creator — {priceLabel('creator')}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-full text-[--secondary] text-[length:var(--text-body-sm)] font-semibold
                         hover:text-[--primary] transition-colors duration-150 cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
