'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { OnboardingCarousel } from './OnboardingCarousel';
import { SlideToContinue } from './SlideToContinue';
import { useNavigate, useOverlayLoading } from '@/components/NavigationTransition';
import { Mascot } from '@/components/mascot/Mascot';
import { motion, AnimatePresence } from 'framer-motion';

type CycleType = 'time-based' | 'welcome-back';

type MascotGreetingType = 'morning' | 'afternoon' | 'evening' | 'welcome';

interface GreetingConfig {
  text: string;
  color: string;
  fontWeight: string;
  mascotType: MascotGreetingType;
}

function getTimeBasedGreeting(): GreetingConfig {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      text: 'Good morning',
      color: 'text-acid-accent',
      fontWeight: 'font-medium',
      mascotType: 'morning',
    };
  }
  if (hour < 17) {
    return {
      text: 'Good afternoon',
      color: 'text-white',
      fontWeight: 'font-light',
      mascotType: 'afternoon',
    };
  }
  return {
    text: 'Good evening',
    color: 'text-[rgba(255,213,79,0.95)]',
    fontWeight: 'font-light',
    mascotType: 'evening',
  };
}

const GREETING_OPTIONS: Record<CycleType, () => GreetingConfig> = {
  'time-based': getTimeBasedGreeting,
  'welcome-back': () => ({
    text: 'Welcome back',
    color: 'text-white/90',
    fontWeight: 'font-medium',
    mascotType: 'welcome',
  }),
};

const CYCLE_TYPES: CycleType[] = ['time-based', 'welcome-back'];

export function SplashScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignUp } = useClerk();
  const { user } = useUser();
  const { navigate } = useNavigate();
  useOverlayLoading(!isLoaded);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % CYCLE_TYPES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentGreeting = useMemo(
    () => {
      const result = GREETING_OPTIONS[CYCLE_TYPES[index]]();
      return typeof result === 'string' ? { text: result, color: 'text-white/45', fontWeight: 'font-medium', mascotType: 'welcome' as MascotGreetingType } : result;
    },
    [index]
  );

  const mascotGreetingType = currentGreeting.mascotType;

  const logo = (
    <div className="absolute top-5 left-5 flex items-center gap-2 z-10">
      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="3" fill="rgba(255,255,255,0.9)" />
          <circle cx="7" cy="7" r="6" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        </svg>
      </div>
      <span className="text-sm font-bold tracking-tight text-white">Ordio</span>
    </div>
  );

  // Radial gradient to fill the space behind mascot
  const mascotBg = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-80 h-80 rounded-full bg-gradient-to-b from-white/[0.03] to-transparent" />
    </div>
  );

  // Mascot - keep original scale
  const mascot = (
    <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <Mascot state="idle" greetingType={mascotGreetingType} className="scale-150" />
    </div>
  );

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <main className="min-h-dvh bg-black relative">
        {logo}
        {mascotBg}
        {mascot}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-6 right-6"
          style={{ bottom: 'var(--splash-bottom)' }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={currentGreeting.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`text-footnote uppercase tracking-[0.1em] mb-2 ${currentGreeting.color} font-medium`}
            >
              {currentGreeting.text}
            </motion.p>
          </AnimatePresence>
          <h1 className="text-[length:var(--text-h1)] leading-[var(--leading-heading)] tracking-[-0.02em] text-white font-heading">
            <span className="font-light">Ready to</span> <span className="font-semibold">create?</span>
          </h1>
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0">
          <SlideToContinue
            onComplete={() => navigate('/create')}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black relative">
      {logo}
      {mascotBg}
      {mascot}
      <OnboardingCarousel onCTA={() => openSignUp()} />
    </main>
  );
}
