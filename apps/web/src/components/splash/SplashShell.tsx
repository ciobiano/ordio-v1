'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Orb } from '@/components/media/orb/Orb';
import { Logo } from '@/components/media/Logo';

export const SPLASH_EASE = [0.22, 1, 0.36, 1] as const;

interface SplashShellProps {
  /** Eyebrow + headline. */
  children: React.ReactNode;
  /** The primary affordance — auth tray when signed out, slide-to-continue when in. */
  action: React.ReactNode;
  /** Lets a tall action (the 4-button auth tray) shrink the Orb rather than overflow. */
  orbClassName?: string;
  /**
   * Identifies which splash state is mounted. Set per state rather than on the
   * shell itself — both states render this same shell, so a fixed id here
   * would match either one.
   */
  testId?: string;
}

/**
 * Shared shell for both splash states, so the signed-in and signed-out screens
 * cannot drift apart.
 *
 * Layout is a flex column rather than absolute positioning. The old screen
 * anchored copy to `var(--splash-bottom)`, progress dashes to `bottom-24` and
 * the CTA to `bottom-7` — three unrelated magic numbers that had to be kept in
 * sync by hand. One column with a single gap scale makes the footer stack
 * structurally incapable of misaligning.
 *
 * The Orb also owns its own glow ring. The previous halo was a separate fixed
 * `w-80 h-80` screen-centred circle sitting behind a `scale-150` mascot that
 * was itself pushed down by safe-area padding, so on any notched device the
 * two could never be concentric.
 */
export function SplashShell({ children, action, orbClassName, testId }: SplashShellProps) {
  const reducedMotion = useReducedMotion();

  return (
    <main data-testid={testId} className="flex min-h-dvh flex-col bg-acid-bg-base safe-pt safe-pb">
      <header className="px-6 pt-5">
        <Logo />
      </header>

      <div className="grid min-h-0 flex-1 place-items-center px-6">
        <Orb state="idle" intensity={0} ariaLabel="Ordio" className={cn(orbClassName)} />
      </div>

      <motion.footer
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: SPLASH_EASE }}
        className="flex flex-col gap-acid-xl px-6 pb-7"
      >
        <div className="flex flex-col gap-acid-sm">{children}</div>
        {action}
      </motion.footer>
    </main>
  );
}
