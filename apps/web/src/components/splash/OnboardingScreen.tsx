'use client';

import { motion } from 'framer-motion';
import { Close } from 'griddy-icons';
import { AudioOrbIcon } from '@/components/primitives/orb/AudioOrbIcon';
import { OnboardingAuthTray } from '@/components/soul/auth/OnboardingAuthTray';
import { useTypewriter } from '@/hooks/useTypewriter';

const PHRASES = [
  "Let's record",
  'Turn talk into captions',
  'Make an audiogram',
  'Ride the waveform',
  'Post your voice',
  'Caption every word',
];

/**
 * Mobile sign-up gate, from the "Ordio Onboarding" handoff. Deliberately a
 * bright white break from the app's dark acid theme elsewhere — a welcoming
 * front door, not the studio itself.
 */
export function OnboardingScreen() {
  const { text, isPhraseComplete } = useTypewriter(PHRASES, true);

  return (
    <main
      data-testid="onboarding-screen"
      className="min-h-dvh bg-white text-acid-bg-base flex flex-col overflow-hidden relative"
    >
      <div
        className="flex-0 flex items-center justify-between px-5.5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 rounded-[10px] bg-[linear-gradient(135deg,#C6FF3D,#6BE0FF)] flex items-center justify-center text-acid-bg-base font-heading font-bold text-xl">
            O
          </div>
          <div className="font-heading font-semibold text-base tracking-[-0.01em]">ordio</div>
        </div>
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full bg-[#EDEDEA] flex items-center justify-center text-acid-bg-base"
        >
          <Close size={15} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-start px-6.5 pb-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-heading font-bold text-[length:var(--text-h1)] leading-[0.98] tracking-[-0.038em]">
          <span>{text || ' '}</span>
          {isPhraseComplete && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.35, ease: [0.3, 0.9, 0.3, 1] }}
              className="inline-flex"
            >
              <AudioOrbIcon size={44} />
            </motion.span>
          )}
        </div>
      </div>

      <div
        className="flex-0 bg-acid-bg-base rounded-t-[40px] px-4 pt-5 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
      >
        <OnboardingAuthTray redirectUrlComplete="/create" className="flex flex-col gap-3" />
        <div className="flex justify-center pt-2">
          <div className="w-34.5 h-1.25 rounded-full bg-acid-text-1" />
        </div>
      </div>
    </main>
  );
}
