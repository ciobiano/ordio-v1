'use client';

import { OnboardingAuthTray } from '@/components/soul/auth/OnboardingAuthTray';
import { acidEyebrow } from '@/lib/variants';
import { SplashShell } from './SplashShell';

/**
 * Mobile sign-up gate.
 */
export function OnboardingScreen() {
  return (
    <SplashShell
      testId="onboarding-screen"
      orbClassName="scale-75"
      action={
        <OnboardingAuthTray redirectUrlComplete="/create" className="flex flex-col gap-3" />
      }
    >
      <p className={acidEyebrow}>Record. Transcribe. Share.</p>
    </SplashShell>
  );
}
