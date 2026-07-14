'use client';

import { useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';

// No dedicated /sign-in route exists in this app — mobile's SplashScreen
// triggers Clerk's imperative modal via useClerk(), not a route redirect.
// Studio mirrors that mechanism, just without the splash animation.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  useEffect(() => {
    if (isLoaded && !isSignedIn) openSignIn();
  }, [isLoaded, isSignedIn, openSignIn]);

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="w-full h-dvh bg-acid-bg-base flex items-center justify-center text-acid-text-3 text-sm">
        Sign in to continue.
      </div>
    );
  }
  return <>{children}</>;
}
