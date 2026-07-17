'use client';

import { useAuth } from '@clerk/nextjs';
import { StudioAuthModal } from '@/components/soul/auth/StudioAuthModal';

// The studio itself always mounts — StudioAuthModal blocks it behind a
// blurred, inert overlay until the user signs up/in, then gets out of the
// way. Replaces the old opaque "Sign in to continue" placeholder + Clerk's
// imperative openSignIn() modal.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  return (
    <>
      <div inert={!isSignedIn} aria-hidden={!isSignedIn}>
        {children}
      </div>
      <StudioAuthModal open={!isSignedIn} />
    </>
  );
}
