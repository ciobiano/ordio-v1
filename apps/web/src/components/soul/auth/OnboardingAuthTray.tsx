'use client';

import { useCallback } from 'react';
import { useClerk } from '@clerk/nextjs';
// The classic (non-signals) hook API — @clerk/nextjs's default useSignUp
// returns the newer SignUpSignalValue shape, which doesn't expose
// authenticateWithRedirect the way this custom flow needs.
import { useSignUp } from '@clerk/nextjs/legacy';
import { toast } from 'sonner';
import { authTrayBtn, authTrayLink } from '@/lib/variants';

type OAuthStrategy = 'oauth_apple' | 'oauth_google';

interface OnboardingAuthTrayProps {
  /** Where Clerk sends the browser back after an OAuth redirect completes. */
  redirectUrlComplete: string;
  className?: string;
}

/**
 * The onboarding entry points (Apple, Google, email) — shared by the mobile
 * onboarding screen and the desktop studio auth modal so both stay wired
 * identically. Email sign-up and log-in collapse into one "Continue with
 * email" link since Clerk's sign-up modal already offers a way to switch to
 * signing in.
 */
export function OnboardingAuthTray({ redirectUrlComplete, className }: OnboardingAuthTrayProps) {
  const { openSignUp } = useClerk();
  const { isLoaded, signUp } = useSignUp();

  const handleOAuth = useCallback(
    async (strategy: OAuthStrategy) => {
      if (!isLoaded) return;
      try {
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl: '/sso-callback',
          redirectUrlComplete,
        });
      } catch {
        toast.error('Sign-in failed. Please try again.');
      }
    },
    [isLoaded, signUp, redirectUrlComplete]
  );

  return (
    <div className={className}>
      <button type="button" className={authTrayBtn({ variant: 'apple' })} onClick={() => handleOAuth('oauth_apple')}>
        Continue with Apple
      </button>
      <button type="button" className={authTrayBtn({ variant: 'google' })} onClick={() => handleOAuth('oauth_google')}>
        Continue with Google
      </button>
      <button type="button" className={authTrayLink} onClick={() => openSignUp()}>
        Continue with email
      </button>
    </div>
  );
}
