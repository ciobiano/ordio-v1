'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingScreen } from './OnboardingScreen';
import { SlideToContinue } from './SlideToContinue';
import { SplashShell, SPLASH_EASE } from './SplashShell';
import { useNavigate, useOverlayLoading } from '@/components/NavigationTransition';
import { acidEyebrow, acidHeading } from '@/lib/variants';

type CycleType = 'time-based' | 'welcome-back';

interface GreetingConfig {
  text: string;
  /** Acid semantic token — never a raw hex. */
  color: string;
}

function getTimeBasedGreeting(): GreetingConfig {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', color: 'text-acid-success' };
  if (hour < 17) return { text: 'Good afternoon', color: 'text-acid-info' };
  return { text: 'Good evening', color: 'text-acid-warning' };
}

const GREETING_OPTIONS: Record<CycleType, () => GreetingConfig> = {
  'time-based': getTimeBasedGreeting,
  'welcome-back': () => ({ text: 'Welcome back', color: 'text-acid-accent' }),
};

const CYCLE_TYPES: CycleType[] = ['time-based', 'welcome-back'];

export function SplashScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { navigate } = useNavigate();
  useOverlayLoading(!isLoaded);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % CYCLE_TYPES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  const greeting = useMemo(() => GREETING_OPTIONS[CYCLE_TYPES[index]](), [index]);

  if (!isLoaded) return null;

  if (!isSignedIn) return <OnboardingScreen />;

  return (
    <SplashShell action={<SlideToContinue onComplete={() => navigate('/create')} />}>
      <AnimatePresence mode="wait">
        <motion.p
          key={greeting.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: SPLASH_EASE }}
          className={`${acidEyebrow} ${greeting.color}`}
          aria-live="polite"
        >
          {greeting.text}
        </motion.p>
      </AnimatePresence>
      <h1 className={acidHeading({ level: 'display' })}>
        <span className="font-normal text-acid-text-2">Ready to</span>{' '}
        <span className="font-black">create?</span>
      </h1>
    </SplashShell>
  );
}
