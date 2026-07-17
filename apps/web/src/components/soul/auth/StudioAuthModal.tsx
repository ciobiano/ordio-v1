'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AudioOrbIcon } from '@/components/primitives/orb/AudioOrbIcon';
import { useTypewriter } from '@/hooks/useTypewriter';
import { OnboardingAuthTray } from './OnboardingAuthTray';

const PHRASES = [
  "Let's record",
  'Turn talk into captions',
  'Make an audiogram',
  'Ride the waveform',
  'Post your voice',
  'Caption every word',
];

interface StudioAuthModalProps {
  open: boolean;
}

/**
 * Desktop sign-up gate: a centered modal blocking the studio behind it
 * (blurred, inert — see app/studio/layout.tsx), not a separate full-screen
 * onboarding route. Same headline/audio-icon/auth-tray as the mobile
 * onboarding screen so both surfaces read as one product; closes itself the
 * instant auth resolves, no dismiss action of its own.
 */
export function StudioAuthModal({ open }: StudioAuthModalProps) {
  const { text, isPhraseComplete } = useTypewriter(PHRASES, open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-acid-bg-base/70 backdrop-blur-2xl px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to Ordio Studio"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="w-full max-w-[400px] rounded-3xl border border-acid-border-subtle bg-acid-surface-1 p-8 flex flex-col items-center gap-6"
          >
            <div className="w-8 h-8 rounded-[9px] bg-[linear-gradient(135deg,#C6FF3D,#6BE0FF)] flex items-center justify-center text-acid-bg-base font-heading font-bold text-lg">
              O
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-heading font-semibold text-[length:var(--text-h2)] leading-[var(--leading-heading)] tracking-[-0.02em] text-acid-text-1 min-h-16">
              <span>{text || ' '}</span>
              {isPhraseComplete && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.35, ease: [0.3, 0.9, 0.3, 1] }}
                  className="inline-flex"
                >
                  <AudioOrbIcon size={36} />
                </motion.span>
              )}
            </div>

            <OnboardingAuthTray redirectUrlComplete="/studio" className="w-full flex flex-col gap-2.5" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
