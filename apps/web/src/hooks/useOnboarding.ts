import { useState, useEffect } from 'react';

const LS_KEY = 'ordio_onboarded';
const TOTAL_STEPS = 4;

export interface UseOnboardingReturn {
  open: boolean;
  step: number;
  next: () => void;    // advances 0→1→2→3; slide 3's CircleButton calls dismiss() instead of next()
  dismiss: () => void; // sets ordio_onboarded + closes; used by ×, skip, and slide 3 done button
}

export function useOnboarding(): UseOnboardingReturn {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // SSR-safe: localStorage is browser-only; must be inside useEffect
    if (localStorage.getItem(LS_KEY) !== 'true') {
      setOpen(true);
    }
  }, []);

  const next = () => {
    // Clamps at TOTAL_STEPS - 1 (index 3); step 3's CircleButton calls dismiss(), not next()
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const dismiss = () => {
    localStorage.setItem(LS_KEY, 'true');
    setOpen(false);
  };

  return { open, step, next, dismiss };
}
