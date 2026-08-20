/**
 * Logo lockup and the share card.
 */

import { cva } from 'class-variance-authority';

/**
 * The brand mark — lime dot plus the Ordio wordmark, as one lockup.
 *
 * Sizes are paired deliberately: the dot and the word have to scale together or
 * the mark stops reading as a single thing. Living here rather than as loose
 * classes because the mark belongs on more than one surface — the only previous
 * copy was private inside SplashShell, which is why the desktop sign-in grew its
 * own substitute (a hardcoded lime-to-cyan gradient tile with a letter "O" in
 * it) instead of using the real mark.
 */
export const brandLogoDot = cva('rounded-full bg-acid-accent shrink-0', {
  variants: {
    size: {
      sm: 'h-6 w-6',
      lg: 'h-14 w-14',
    },
  },
  defaultVariants: { size: 'sm' },
});

export const brandLogoWord = cva('font-acid-display font-bold text-acid-text-1', {
  variants: {
    size: {
      sm: 'text-acid-label',
      lg: 'text-acid-title',
    },
  },
  defaultVariants: { size: 'sm' },
});

export const brandLogoLockup = cva('flex items-center', {
  variants: {
    size: {
      sm: 'gap-2',
      lg: 'gap-4',
    },
  },
  defaultVariants: { size: 'sm' },
});

/**
 * Share card — the hero export artifact ("Wrapped for your voice"). 9:16,
 * chunky radius, bold color variants. Independent of the main app's accent —
 * this is where colorful, varied theming lives per DESIGN.md.
 *
 *   variant: 'sunset'   → coral → pink, warm/friendly
 *            'acid'     → ink + electric lime, young/loud
 *            'electric' → cobalt → cyan, cool/modern
 */
export const shareCard = cva('relative aspect-9/16 rounded-acid-xl overflow-hidden', {
  variants: {
    variant: {
      sunset: 'bg-[linear-gradient(155deg,#FF8A4A_0%,#FF2E7E_55%,#B0165C_100%)] text-white',
      acid: 'bg-acid-bg-base text-acid-text-1',
      electric: 'bg-[linear-gradient(155deg,#3A2BFF_0%,#4D7CFF_45%,#00D4FF_100%)] text-white',
    },
  },
  defaultVariants: { variant: 'acid' },
});

/**
 * Share card headline — the one emphasized line per card, gradient text.
 * Reserved usage: never a background wash, only this single line.
 */
export const shareCardHeadline = cva('font-acid-display font-semibold', {
  variants: {
    variant: {
      sunset: 'text-[#FFF0D6]',
      acid: 'text-acid-signal',
      electric: 'text-[#CFF6FF]',
    },
  },
  defaultVariants: { variant: 'acid' },
});
