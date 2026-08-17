'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/primitives/Logo';
import { acidHeading } from '@/lib/variants';
import { OnboardingAuthTray } from './OnboardingAuthTray';

/**
 * Desktop sign-in gate: a small centred card over the blurred, inert workspace.
 *
 * The mobile onboarding screen is a full-bleed column — orb centred in the
 * viewport, auth buttons spanning the full width, eyebrow pinned to the bottom.
 * That composition depends on the viewport being phone-shaped. Stretched to
 * 1670px it falls apart: a small orb adrift in a field of black, buttons a metre
 * wide, and the copy stranded in a corner far from the controls it introduces.
 *
 * So the two surfaces get two compositions from one design system, which is the
 * same split the capture flow itself uses. A modal also says the right thing on
 * desktop — the workspace is already there behind you, sign in to reach it —
 * rather than presenting sign-up as the whole screen.
 *
 * This restores the shape of the modal that used to live at /studio. That one
 * was deleted for its contents, not its layout: it drew its own logo as a
 * rounded square holding the letter "O" on a hardcoded
 * `linear-gradient(135deg,#C6FF3D,#6BE0FF)`, and cycled six phrases through a
 * typewriter that took ~22 seconds to get round. The container was always right;
 * the decoration was the problem. It now uses the real mark and a static line.
 */
export function DesktopAuthModal() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-acid-bg-base/70 px-6 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Ordio"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="flex w-full max-w-100 flex-col items-center gap-6 rounded-3xl border border-acid-border-subtle bg-acid-surface-1 p-8"
      >
        <Logo />

        <h1 className={`${acidHeading({ level: 'headline' })} text-center`}>
          Record. Transcribe. Share.
        </h1>

        <OnboardingAuthTray
          redirectUrlComplete="/create"
          className="flex w-full flex-col gap-2.5"
        />
      </motion.div>
    </div>
  );
}
