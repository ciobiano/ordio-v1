import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Landing page for Clerk's OAuth redirect flow (Apple/Google "Continue with"
// buttons in OnboardingAuthTray) — Clerk completes the sign-in here, then
// forwards to whatever redirectUrlComplete the caller passed.
export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
