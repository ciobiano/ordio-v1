'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@Ordio/convex'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { primaryBtn, captureSheetSurface } from '@/lib/variants'
import type { FeatureKey } from '@/lib/featureGates'
import type { UpgradeTarget } from '@/stores/uiStore'

interface WaitlistSheetProps {
  open: boolean
  onClose: () => void
  /** Why the sheet opened. See `UpgradeTarget`. */
  target?: UpgradeTarget
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
 * Nothing here sells anything — there is no price and no tier to move to. The
 * honest thing to say is that a free allowance ran out and that we will tell
 * them if that ever changes, so the copy promises exactly that and no more.
 *
 * Limits avoid the word "failed" and never name credits, which are an internal
 * unit; people are shown minutes everywhere else in the product.
 */
export function copyFor(target: UpgradeTarget | undefined): { title: string; body: string } {
  if (target === undefined || target === 'export_limit') {
    return {
      title: 'Daily export limit reached',
      body: 'Your work is saved. Exports open up again tomorrow — leave your email and we will tell you when the cap lifts for good.',
    }
  }

  if (target === 'transcription_credits') {
    return {
      title: 'Transcription paused',
      body: 'Your recording is safe — you have used up your free transcription minutes. Leave your email and we will tell you when more are available.',
    }
  }

  return {
    title: `${featureLabel(target)} is not available yet`,
    body: 'Leave your email and we will tell you when it ships.',
  }
}

export default function WaitlistSheet({ open, onClose, target }: WaitlistSheetProps) {
  const { user } = useUser()
  const alreadyJoined = useQuery(api.waitlist.amIOnTheWaitlist)
  const joinWaitlist = useMutation(api.waitlist.joinWaitlist)

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  const { title, body } = copyFor(target)

  // Clerk knows the address for most sign-ins; asking again would be theatre.
  const prefilled = user?.primaryEmailAddress?.emailAddress ?? ''
  const value = email || prefilled

  // `undefined` is Convex still loading — treat it as not-yet-known rather than
  // as "not joined", or the sheet flashes the form at someone already on the list.
  const onList = alreadyJoined === true || status === 'done'

  const handleJoin = async () => {
    if (!value.trim()) return
    setStatus('saving')
    try {
      await joinWaitlist({ email: value.trim(), reason: target ?? 'unknown' })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className={cn(captureSheetSurface, 'p-0 max-h-[85vh]')}>
        <DrawerTitle className="sr-only">Join the waitlist</DrawerTitle>
        <div className="w-full max-w-sm mx-auto px-6 py-6">
          <div className="w-9 h-[5px] rounded-full bg-white/[0.25] mx-auto mb-5" aria-hidden="true" />

          <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center mb-4 mx-auto">
            <Image src="/icons/lock.svg" width={18} height={18} alt="" aria-hidden="true" className="invert opacity-50" />
          </div>

          <h2 className="text-sm font-semibold text-foreground text-center mb-2 leading-snug">
            {onList ? 'You are on the list' : title}
          </h2>

          <p className="text-xs text-muted-foreground text-center leading-relaxed mb-6">
            {onList ? 'We will email you when more minutes are available.' : body}
          </p>

          {!onList && (
            <input
              type="email"
              value={value}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="w-full mb-2.5 px-4 py-3 rounded-full bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {status === 'error' && (
            <p className="text-xs text-center text-destructive mb-2.5">
              That did not save. Try again in a moment.
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            {!onList && (
              <Button
                onClick={() => void handleJoin()}
                disabled={status === 'saving' || !value.trim()}
                className={cn(primaryBtn, 'w-full')}
              >
                {status === 'saving' ? 'Adding you…' : 'Join the waitlist'}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full py-3 rounded-full text-muted-foreground text-sm font-semibold hover:text-foreground hover:bg-transparent"
            >
              {onList ? 'Close' : 'Maybe later'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
