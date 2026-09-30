'use client';

import { useCallback, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useClerk } from '@clerk/nextjs';
// The classic (non-signals) hook API — @clerk/nextjs's default useSignUp
// returns the newer SignUpSignalValue shape, which doesn't expose
// authenticateWithRedirect the way this custom flow needs.
import { useSignUp } from '@clerk/nextjs/legacy';
import { toast } from 'sonner';
import { authTraySpinner, paperButton } from '@/lib/variants';
import { cn } from '@/lib/utils';

type OAuthStrategy = 'oauth_apple' | 'oauth_google';

interface OnboardingAuthTrayProps {
  /** Where Clerk sends the browser back after an OAuth redirect completes. */
  redirectUrlComplete: string;
  className?: string;
}

/**
 * The onboarding entry points (Google, Apple, email, log in) — shared by the
 * mobile sign-up screen and the desktop auth modal so both stay wired
 * identically. Providers sit side by side as paper buttons; email is a field
 * whose Continue opens Clerk's sign-up with the address already filled in.
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
function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M15.2 8.2c0-.5 0-1-.1-1.5H8v2.9h4a3.4 3.4 0 0 1-1.5 2.2v1.8h2.4c1.4-1.3 2.3-3.2 2.3-5.4z" fill="#4285F4" />
      <path d="M8 15.5c2 0 3.7-.7 4.9-1.8l-2.4-1.8c-.7.4-1.5.7-2.5.7-1.9 0-3.6-1.3-4.2-3.1H1.3v1.9A7.4 7.4 0 0 0 8 15.5z" fill="#34A853" />
      <path d="M3.8 9.5a4.4 4.4 0 0 1 0-3V4.6H1.3a7.4 7.4 0 0 0 0 6.8l2.5-1.9z" fill="#FBBC05" />
      <path d="M8 3.5c1.1 0 2.1.4 2.9 1.1l2.1-2.1A7.4 7.4 0 0 0 1.3 4.6l2.5 1.9C4.4 4.8 6.1 3.5 8 3.5z" fill="#EA4335" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="15" height="17" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
      <path d="M13.2 9.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.7C4.6 4.8 3.3 5.6 2.6 6.9c-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.5zM11.1 3.3c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

export function OnboardingAuthTray({ redirectUrlComplete, className }: OnboardingAuthTrayProps) {
  const { openSignUp, openSignIn } = useClerk();
  const { isLoaded, signUp } = useSignUp();
  const [pending, setPending] = useState<OAuthStrategy | null>(null);
  const [email, setEmail] = useState('');
  const emailId = useId();

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

  // Email sign-up continues in Clerk's own modal, which owns verification
  // codes and passwords; the address typed here is handed over so nobody
  // types it twice.
  const handleEmail = (event: FormEvent) => {
    event.preventDefault();
    const emailAddress = email.trim();
    openSignUp(emailAddress ? { initialValues: { emailAddress } } : undefined);
  };

  const busy = pending !== null;

  return (
    <form className={cn('flex flex-col', className)} onSubmit={handleEmail}>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['oauth_google', 'Google', <GoogleGlyph key="g" />],
            ['oauth_apple', 'Apple', <AppleGlyph key="a" />],
          ] as const
        ).map(([strategy, label, glyph]) => (
          <button
            key={strategy}
            type="button"
            className={cn(paperButton({ size: 'md' }), busy && pending !== strategy && 'opacity-40')}
            onClick={() => handleOAuth(strategy)}
            disabled={busy}
            aria-busy={pending === strategy}
            aria-label={`Continue with ${label}`}
          >
            {pending === strategy ? <span className={authTraySpinner} aria-hidden="true" /> : glyph}
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 py-5.5 text-[13px] text-acid-text-3 short:py-4" aria-hidden="true">
        <span className="h-px flex-1 bg-acid-text-1/10" />
        or
        <span className="h-px flex-1 bg-acid-text-1/10" />
      </div>

      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <input
        id={emailId}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        className="h-13.5 w-full rounded-[16px] border border-acid-text-1/8 bg-acid-surface-2 px-4.5 text-[15px] text-acid-text-1 placeholder:text-acid-text-3 focus:border-acid-accent focus:outline-none"
      />

      <div className="min-h-5 flex-1" />

      <button type="submit" className={paperButton({ size: 'lg' })} disabled={busy}>
        Continue
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <p className="m-0 mt-4.5 text-center text-sm text-acid-text-3">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => openSignIn()}
          disabled={busy}
          className="cursor-pointer border-none bg-transparent p-0 font-semibold text-acid-text-1 underline-offset-4 hover:underline"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
