'use client';

import { OnboardingAuthTray } from '@/components/mobile/auth/OnboardingAuthTray';
import { acidEyebrow } from '@/lib/variants';
import { SplashShell } from './SplashShell';

/**
 * Mobile sign-up gate.
 *
 * Phone-shaped on purpose — orb centred in the viewport, auth buttons full width,
 * eyebrow at the bottom edge. Desktop never renders this: it signs in through a
 * centred modal over the workspace instead (see DesktopAuthModal), because every
 * one of those choices stops working when the viewport is 1670px wide.
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
