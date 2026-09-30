'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { OnboardingAuthTray } from '@/components/mobile/auth/OnboardingAuthTray';
import { Logo } from '@/components/media/Logo';
import { paperButton } from '@/lib/variants';
import { ONBOARDING_ART, STAGE_H, STAGE_W, MarkTile } from './onboarding/OnboardingArt';
import { ONBOARDING_SLIDES } from './onboarding/copy';
import { OnboardingHeadline, StepBars } from './onboarding/Headline';
import { useStageScale } from './onboarding/useStageScale';
import { SPLASH_EASE } from './SplashShell';

/** Once someone has been through the slides, a return visit opens on sign-up. */
const SEEN_KEY = 'ordio:onboarding-seen';
const SIGN_UP = ONBOARDING_SLIDES.length;

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: they will see the slides again. Harmless.
  }
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="-ml-2.5 flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-acid-text-1"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M16 10H4M9 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WelcomeSlide({
  step,
  onBack,
  onNext,
  onSkip,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const slide = ONBOARDING_SLIDES[step];
  const Art = ONBOARDING_ART[step];
  const { ref, scale } = useStageScale(STAGE_W, STAGE_H);
  const isLast = step === ONBOARDING_SLIDES.length - 1;

  return (
    <>
      <header className="relative z-2 flex h-11 shrink-0 items-center justify-between">
        {step === 0 ? <Logo /> : <BackButton onClick={onBack} />}
        <button
          type="button"
          onClick={onSkip}
          className="flex h-11 cursor-pointer items-center border-none bg-transparent px-1 text-[15px] font-medium text-acid-text-1"
        >
          Skip
        </button>
      </header>

      <div ref={ref} className="relative -mx-5 min-h-0 flex-1" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2"
          style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <Art />
        </div>
      </div>

      <StepBars step={step} />

      <div className="flex flex-col items-center gap-3 pt-4.5 text-center short:gap-2 short:pt-3">
        <OnboardingHeadline head={slide.head} accent={slide.accent} breakBeforeAccent={slide.breakBeforeAccent} className="max-w-80" />
        <p className="m-0 max-w-72.5 text-[15px] leading-normal text-acid-text-3">{slide.sub('phone')}</p>
      </div>

      <div className="h-5 shrink-0" />

      <button type="button" onClick={onNext} className={paperButton({ size: 'lg' })}>
        {isLast ? 'Get started' : 'Next'}
        <Chevron />
      </button>
    </>
  );
}

function SignUpStep({ onBack }: { onBack: () => void }) {
  return (
    <>
      {/* The looks, faded behind the form — the product is still in view. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-5 -right-7.5 -left-7.5 grid h-95 -rotate-6 grid-cols-3 gap-3 opacity-22">
        <div className="relative h-42.5 overflow-hidden rounded-[20px]">
          <Image src="/backgrounds/friends-thumb.jpg" alt="" fill sizes="140px" className="object-cover" />
        </div>
        <div className="mt-10 h-42.5 rounded-[20px] bg-acid-accent" />
        <div className="relative h-42.5 overflow-hidden rounded-[20px]">
          <Image src="/backgrounds/podcast-thumb.jpg" alt="" fill sizes="140px" className="object-cover" />
        </div>
        <div className="h-42.5 rounded-[20px] bg-acid-look-street" />
        <div className="relative mt-10 h-42.5 overflow-hidden rounded-[20px]">
          <Image src="/backgrounds/cafe-thumb.jpg" alt="" fill sizes="140px" className="object-cover" />
        </div>
        <div className="h-42.5 rounded-[20px] bg-acid-look-cinema" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-105 bg-[linear-gradient(180deg,rgb(10_11_9/0.2)_0%,rgb(10_11_9/0.85)_70%,var(--acid-bg-base)_100%)]"
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center">
          <BackButton onClick={onBack} />
        </header>

        <div className="flex flex-col items-center gap-5.5 pt-12 short:gap-4 short:pt-4">
          <MarkTile markWidth={64} className="h-21 w-21 rounded-[22px] short:h-17 short:w-17" />
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.025em] text-acid-text-1">
            Create an <span className="font-acid-serif text-[34px] font-normal italic">account</span>
          </h1>
        </div>

        <OnboardingAuthTray redirectUrlComplete="/create" className="min-h-0 flex-1 pt-7.5 short:pt-5" />
      </div>
    </>
  );
}

/**
 * Mobile onboarding: three welcome slides, then sign-up.
 *
 * Desktop never renders this — it signs in through DesktopAuthModal over the
 * workspace, which carries the same three slides in its left column.
 */
export function OnboardingScreen() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  // Read after mount: the server cannot know, and guessing would mismatch.
  useEffect(() => {
    if (readSeen()) setStep(SIGN_UP);
  }, []);

  const go = (next: number) => {
    if (next >= SIGN_UP) markSeen();
    setStep(Math.max(0, Math.min(SIGN_UP, next)));
  };

  return (
    <main
      data-testid="onboarding-screen"
      className="relative flex h-dvh flex-col overflow-hidden bg-acid-bg-base px-5 pt-[max(12px,env(safe-area-inset-top))] safe-pb-dock"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex min-h-0 flex-1 flex-col"
          initial={reducedMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: SPLASH_EASE }}
        >
          {step < SIGN_UP ? (
            <WelcomeSlide
              step={step}
              onBack={() => go(step - 1)}
              onNext={() => go(step + 1)}
              onSkip={() => go(SIGN_UP)}
            />
          ) : (
            <SignUpStep onBack={() => setStep(SIGN_UP - 1)} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
