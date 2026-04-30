'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
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
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent
        className="bg-[color:var(--glass-bg)] backdrop-blur-xl border-t border-white/[0.08] p-0 max-h-[85vh]"
      >
        <DrawerTitle className="sr-only">Upgrade to Creator</DrawerTitle>
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
      </DrawerContent>
    </Drawer>
  )
}
