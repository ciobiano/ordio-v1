'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@Ordio/convex'
import { OrdSheet, OrdSheetActions } from '@/components/ui/OrdSheet'
import { sheetButton } from '@/lib/variants'
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
    <OrdSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={onList ? 'You are on the list' : title}
      description={onList ? 'We will email you when more minutes are available.' : body}
      eyebrow={
        !onList ? (
          <span className="self-start rounded-full bg-acid-warning/12 px-2.5 py-1 font-acid-mono text-[11px] tracking-widest text-acid-warning">
            COMING SOON
          </span>
        ) : undefined
      }
      showClose
      footer={
        onList ? (
          <button type="button" onClick={onClose} className={sheetButton({ tone: 'secondary' })}>
            Close
          </button>
        ) : (
          <OrdSheetActions>
            <button type="button" onClick={onClose} className={sheetButton({ tone: 'secondary' })}>
              Maybe later
            </button>
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={status === 'saving' || !value.trim()}
              className={sheetButton({ tone: 'primary' })}
            >
              {status === 'saving' ? 'Adding you…' : 'Join the waitlist'}
            </button>
          </OrdSheetActions>
        )
      }
    >
      {!onList && (
        <input
          type="email"
          value={value}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-13 w-full rounded-[14px] border border-acid-text-1/8 bg-acid-text-1/5 px-4 text-[15px] text-acid-text-1 placeholder:text-acid-text-3 focus:border-acid-accent focus:outline-none"
        />
      )}

      {status === 'error' && (
        <p className="m-0 text-[13px] text-acid-error" role="alert">
          That did not save. Try again in a moment.
        </p>
      )}
    </OrdSheet>
  )
}
