'use client'

import { useClerk } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { primaryBtn } from '@/lib/variants'

export default function AuthGate() {
  const { openSignIn, openSignUp } = useClerk()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm text-center">

        <div className="mb-8">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-white/30 mb-3">
            ordio
          </p>
          <h1 className="text-[length:var(--text-h4)] font-semibold text-foreground leading-snug mb-3">
            Turn audio into video
          </h1>
          <p className="text-sm text-white/40 leading-relaxed">
            Waveform clips with auto-captions, ready for social media.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            onClick={() => openSignUp()}
            className={cn(primaryBtn, 'w-full')}
          >
            Get started free
          </Button>
          <Button
            variant="ghost"
            onClick={() => openSignIn()}
            className="w-full py-3 rounded-full border border-white/10 text-muted-foreground
                       text-sm font-semibold hover:border-white/20
                       hover:text-foreground hover:bg-transparent transition-all duration-150"
          >
            Sign in
          </Button>
        </div>

      </div>
    </div>
  )
}
