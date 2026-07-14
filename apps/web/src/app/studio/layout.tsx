// apps/web/src/app/studio/layout.tsx
// Desktop workspace shell — deliberately bare: no splash screen, no onboarding
// carousel, no mobile chrome. The workspace morphs in place rather than
// navigating between routes, so this layout stays minimal by design.
'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';

function StudioLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/create');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isLoading || !isSignedIn) return null;

  return (
    <div className="relative min-h-dvh bg-black text-[--primary] font-[family-name:var(--font-jakarta)]">
      {children}
    </div>
  );
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioLayoutContent>{children}</StudioLayoutContent>;
}
