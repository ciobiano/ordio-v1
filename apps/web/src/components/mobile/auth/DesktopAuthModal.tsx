'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/media/Logo';
import { acidHeading } from '@/lib/variants';
import { OnboardingAuthTray } from './OnboardingAuthTray';

/**
 * Desktop sign-in gate: a small centred card over the dimmed, inert workspace.
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
 * Dimmed rather than blurred. `backdrop-blur-2xl` over a dark workspace
 * destroys the only proof the product exists: at that radius the desk stops
 * being a desk and becomes noise. A wash plus a light blur keeps its shape
 * legible while leaving no doubt which layer is in front.
 *
 * The card holds four things and no more — the mark, one line, the tray, and
 * what it costs. It previously carried a sample frame of a captioned clip as a
 * second column; the desk behind already does that job, and doing it twice made
 * a 620px card out of 400px of content.
 */
export function DesktopAuthModal() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-acid-bg-base/78 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Ordio"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="flex w-full max-w-102 flex-col gap-5 rounded-3xl border border-acid-border-subtle bg-acid-surface-1 p-7"
      >
        {/* The real mark. Logo.tsx exists so a second surface cannot invent a
            third version of it — this is the call site its docstring is about. */}
        <Logo />

        {/* One line, and it names what you leave with rather than listing the
            steps. "Record. Transcribe. Share." was three verbs that could sit
            on any audio tool. Headline, not display: a 400px card has no room
            for a display line, and DESIGN.md allows one per screen at most. */}
        <h1 className={acidHeading({ level: 'headline' })}>Voice in. Video out.</h1>

        <OnboardingAuthTray
          redirectUrlComplete="/create"
          className="flex w-full flex-col gap-2.5"
        />

        {/* The cost, stated. Ordio takes no money, and a stranger at a sign-in
            wall has no way to know that unless it is written down. */}
        <p className="text-acid-footnote text-acid-text-3">
          Free, with no card. Your recordings stay on your account.
        </p>
      </motion.div>
    </div>
  );
}
