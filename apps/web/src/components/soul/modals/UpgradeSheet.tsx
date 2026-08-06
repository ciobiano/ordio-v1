'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { useCheckout } from '@/hooks/billing/useCheckout'
import { primaryBtn, captureSheetSurface } from '@/lib/variants'
import type { FeatureKey } from '@/lib/featureGates'
import type { UpgradeTarget } from '@/stores/uiStore'

interface UpgradeSheetProps {
  open: boolean
  onClose: () => void
  /** Why the sheet opened. See `UpgradeTarget`. */
  target?: UpgradeTarget
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
    unlimited_exports: 'Unlimited Exports',
    background_video: 'Video Backgrounds',
    background_upload: 'Custom Backgrounds',
    director_reroll: 'More Director Looks',
  }
  return labels[feature]
}

/**
 * What the sheet says, per reason for opening.
 *
 * Limits get their own copy because they are not locked features — the user did
 * nothing wrong and nothing is broken, they have used an allowance up. The
 * wording avoids "failed" and avoids naming credits, which are an internal unit;
 * people are shown minutes everywhere else.
 */
export function copyFor(target: UpgradeTarget | undefined): { title: string; body: string } {
  if (target === undefined || target === 'export_limit') {
    return {
      title: 'Daily export limit reached',
      body: 'Unlimited exports are included with Creator.',
    }
  }

  if (target === 'transcription_credits') {
    return {
      title: 'Transcription paused',
      body: 'Your recording is safe — you have used up your free transcription minutes. Creator adds more every month.',
    }
  }

  return {
    title: `${featureLabel(target)} is a Creator feature`,
    body: 'Upgrade to Creator to unlock this feature.',
  }
}

export default function UpgradeSheet({ open, onClose, target, onUpgrade }: UpgradeSheetProps) {
  const { priceLabel } = useCheckout()

  const { title, body } = copyFor(target)

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent
        className={cn(captureSheetSurface, 'p-0 max-h-[85vh]')}
      >
        <DrawerTitle className="sr-only">Upgrade to Creator</DrawerTitle>
        <div className="w-full max-w-sm mx-auto px-6 py-6">
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
      </DrawerContent>
    </Drawer>
  )
}
