'use client';

import { useCallback, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
// The classic (non-signals) hook API — @clerk/nextjs's default useSignUp
// returns the newer SignUpSignalValue shape, which doesn't expose
// authenticateWithRedirect the way this custom flow needs.
import { useSignUp } from '@clerk/nextjs/legacy';
import { toast } from 'sonner';
import { authTrayBtn, authTrayLink, authTraySpinner } from '@/lib/variants';

type OAuthStrategy = 'oauth_apple' | 'oauth_google';

interface OnboardingAuthTrayProps {
  /** Where Clerk sends the browser back after an OAuth redirect completes. */
  redirectUrlComplete: string;
  className?: string;
}

/**
 * The onboarding entry points (Apple, Google, email) — shared by the mobile
 * onboarding screen and the desktop auth modal so both stay wired identically.
 * Email sign-up and log-in collapse into one "Continue with email" link since
 * Clerk's sign-up modal already offers a way to switch to signing in.
 *
 * Pressing a provider used to change nothing on screen. `authenticateWithRedirect`
 * has to reach Clerk before the browser navigates, and for that whole round trip
 * the tray looked idle — so the button read as broken and the natural response was
 * to press it again, or to try the other provider, either of which starts a second
 * handoff over the first.
 *
 * A pending press therefore disables the whole tray. The pressed button keeps full
 * contrast and gains a spinner; the others dim. There is deliberately no success
 * state to return to: on success the browser leaves the page, so `pending` is
 * cleared only when the attempt actually fails.
 */
export function OnboardingAuthTray({ redirectUrlComplete, className }: OnboardingAuthTrayProps) {
  const { openSignUp } = useClerk();
  const { isLoaded, signUp } = useSignUp();
  const [pending, setPending] = useState<OAuthStrategy | null>(null);

  const handleOAuth = useCallback(
    async (strategy: OAuthStrategy) => {
      // Guard on `pending` as well as the ref: a fast double-press can fire twice
      // before React re-renders the disabled attribute onto the button.
      if (!isLoaded || pending) return;
      setPending(strategy);
      try {
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl: '/sso-callback',
          redirectUrlComplete,
        });
      } catch {
        // Only reachable if the handoff failed — a success navigates away.
        setPending(null);
        toast.error('Sign-in failed. Please try again.');
      }
    },
    [isLoaded, pending, signUp, redirectUrlComplete]
  );

  const stateFor = (strategy: OAuthStrategy) => {
    if (!pending) return 'idle' as const;
    return pending === strategy ? ('waiting' as const) : ('blocked' as const);
  };

  return (
    <div className={className}>
      <button
        type="button"
        className={authTrayBtn({ variant: 'apple', state: stateFor('oauth_apple') })}
        onClick={() => handleOAuth('oauth_apple')}
        disabled={pending !== null}
        aria-busy={pending === 'oauth_apple'}
      >
        {pending === 'oauth_apple' && <span className={authTraySpinner} aria-hidden="true" />}
        Continue with Apple
      </button>
      <button
        type="button"
        className={authTrayBtn({ variant: 'google', state: stateFor('oauth_google') })}
        onClick={() => handleOAuth('oauth_google')}
        disabled={pending !== null}
        aria-busy={pending === 'oauth_google'}
      >
        {pending === 'oauth_google' && <span className={authTraySpinner} aria-hidden="true" />}
        Continue with Google
      </button>
      <button
        type="button"
        className={authTrayLink}
        onClick={() => openSignUp()}
        disabled={pending !== null}
      >
        Continue with email
      </button>
    </div>
  );
}
