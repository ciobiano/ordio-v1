'use client';

import { motion, type Variants } from 'framer-motion';
import { OrdioMark } from '@/components/ui/OrdioMark';
import { cn } from '@/lib/utils';

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
};

interface TransitionOverlayProps {
  /** First paint: render fully opaque, so the server HTML already shows the mark. */
  instant?: boolean;
}

/**
 * The page-transition loader. Ink ground, the arcs mark assembling from its
 * centre, then a lime pulse travelling outward until the next page is ready.
 * Timing lives in ord-motion.css: build 0–0.7s, loop 1.8s, exit 0.25s.
 */
export function TransitionOverlay({ instant = false }: TransitionOverlayProps) {
  return (
    <motion.div
      key="transition-overlay"
      data-testid="transition-overlay"
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center bg-acid-bg-base text-acid-text-1',
        instant && 'ord-overlay-failsafe'
      )}
      variants={overlayVariants}
      initial={instant ? false : 'hidden'}
      animate="visible"
      exit="exit"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <OrdioMark size={220} className="h-auto w-55 short:w-44 md:w-70" />
    </motion.div>
  );
}
