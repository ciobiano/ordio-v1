'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/media/Logo';
import { cn } from '@/lib/utils';
import { ONBOARDING_ART, STAGE_H, STAGE_W, MarkTile } from '@/components/splash/onboarding/OnboardingArt';
import { ONBOARDING_SLIDES } from '@/components/splash/onboarding/copy';
import { OnboardingHeadline, StepBars } from '@/components/splash/onboarding/Headline';
import { OnboardingAuthTray } from './OnboardingAuthTray';

function ArrowButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous' : 'Next'}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-acid-text-1/7 text-acid-text-1 transition-opacity disabled:cursor-default disabled:opacity-40"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d={dir === 'prev' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Desktop sign-in gate: a two-column card over the dimmed, inert workspace.
 *
 * Left is the phone's three onboarding slides as a carousel, so a desktop
 * visitor meets the same story a phone visitor swipes through; right is the
 * same sign-up form the phone ends on. One set of copy, one form component —
 * the two surfaces cannot drift.
 *
 * Dimmed rather than blurred: the desk behind stays legible as a desk, which
 * is the only proof the product exists before you sign in.
 */
export function DesktopAuthModal() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const slide = ONBOARDING_SLIDES[step];
  const Art = ONBOARDING_ART[step];
  const last = ONBOARDING_SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(5_6_5/0.8)] p-6">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-signup-title"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="flex h-[min(620px,calc(100dvh-48px))] w-full max-w-240 overflow-hidden rounded-[32px] border border-acid-text-1/10 bg-acid-surface-1 shadow-[0_50px_140px_rgb(0_0_0/0.75)]"
      >
        <div className="relative hidden w-120 shrink-0 flex-col bg-acid-bg-subtle px-8 pt-7 pb-8 lg:flex">
          <div className="relative z-2">
            <Logo />
          </div>

          <div className="relative -mx-8 h-85 shrink-0 overflow-hidden" aria-hidden="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                className="absolute top-1/2 left-1/2"
                style={{ width: STAGE_W, height: STAGE_H, x: '-50%', y: '-50%', scale: 0.8 }}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Art />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative z-2 flex flex-col items-center gap-2.5 text-center" aria-live="polite">
            <OnboardingHeadline as="h2" head={slide.head} accent={slide.accent} className="text-[30px]" />
            <p className="m-0 max-w-85 text-[15px] leading-normal text-acid-text-3">{slide.sub('computer')}</p>
          </div>

          <div className="flex-1" />

          <div className="relative z-2 flex items-center justify-between">
            <ArrowButton dir="prev" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} />
            <StepBars step={step} onPick={setStep} />
            <ArrowButton dir="next" disabled={step === last} onClick={() => setStep((s) => Math.min(last, s + 1))} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-14 pt-16 pb-10 max-lg:px-8 max-lg:pt-10">
          <MarkTile markWidth={48} className="h-16 w-16 shrink-0 rounded-[18px]" />
          <h1 id="desk-signup-title" className="m-0 mt-7 text-[32px] font-bold tracking-[-0.03em] text-acid-text-1">
            Create an <span className="font-acid-serif text-[38px] font-normal italic">account</span>
          </h1>
          {/* The cost, stated. Ordio takes no money, and a stranger at a sign-in
              wall has no way to know that unless it is written down. */}
          <p className={cn('m-0 mt-2 text-[15px] text-acid-text-3')}>
            Free, with no card. Your recordings stay on your account.
          </p>
          <OnboardingAuthTray redirectUrlComplete="/create" className="min-h-0 flex-1 pt-8" />
        </div>
      </motion.section>
    </div>
  );
}
