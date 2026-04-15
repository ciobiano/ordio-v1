'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCheckout } from '@/hooks/billing/useCheckout'
import { primaryBtn } from '@/lib/variants'
import type { FeatureKey } from '@/lib/featureGates'

interface UpgradeSheetProps {
  open: boolean
  onClose: () => void
  feature?: FeatureKey
  onSignIn?: () => void
  onUpgrade?: () => void
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
    layout_flipped: 'Flipped Layout',
    caption_karaoke: 'Karaoke Mode',
    unlimited_exports: 'Unlimited Exports',
  }
  return labels[feature]
}

export default function UpgradeSheet({ open, onClose, feature, onUpgrade }: UpgradeSheetProps) {
  const { priceLabel } = useCheckout()

  const isExportLimit = feature === undefined
  const title = isExportLimit
    ? 'Daily export limit reached'
    : `${featureLabel(feature)} is a Creator feature`
  const body = isExportLimit
    ? 'Unlimited exports are included with Creator.'
    : 'Upgrade to Creator to unlock this feature.'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="border-0 bg-transparent shadow-none px-4 pb-8 pt-6 flex flex-col items-center"
      >
        <div className="w-full max-w-sm rounded-3xl bg-[--surface-glass-card] backdrop-blur-[40px] backdrop-saturate-[160%] [box-shadow:var(--shadow-glass-top)] px-6 py-6">
          <div className="w-9 h-[5px] rounded-full bg-white/[0.25] mx-auto mb-5" aria-hidden="true" />

          <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center mb-4 mx-auto">
            <Image src="/icons/lock.svg" width={18} height={18} alt="" aria-hidden="true" className="invert opacity-50" />
          </div>

          <h2
            id="upgrade-sheet-title"
            className="text-sm font-semibold text-foreground text-center mb-2 leading-snug"
          >
            {title}
          </h2>

          <p className="text-xs text-muted-foreground text-center leading-relaxed mb-6">
            {body}
          </p>

          <div className="flex flex-col gap-2.5">
            {onUpgrade && (
              <Button
                onClick={() => { onClose(); onUpgrade() }}
                className={cn(primaryBtn, 'w-full')}
              >
                Upgrade to Creator — {priceLabel('creator')}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full py-3 rounded-full text-muted-foreground text-sm font-semibold hover:text-foreground hover:bg-transparent"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
