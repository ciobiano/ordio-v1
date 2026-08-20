// apps/web/src/app/create/layout.tsx
// HIG-compliant layout: minimal chrome, content-first, proper safe areas
'use client';

import { Suspense } from 'react';
import { useUIStore } from '@/stores';
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useAuth } from '@clerk/nextjs';
import { CapabilityBanner } from '@/components/media';
import { WaitlistSheet } from '@/components/mobile';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { DesktopAuthModal } from '@/components/mobile/auth/DesktopAuthModal';
import { useIsDesktopViewport } from '@/hooks/useBreakpoint';
import { useOverlayLoading } from '@/components/NavigationTransition';

function CreateLayoutContent({ children }: { children: React.ReactNode }) {
  const { upgradeTarget, setUpgradeTarget } = useUIStore();
  const capabilities = useCapabilities();
  const { isLoading } = useCurrentUser();
  const { isSignedIn } = useAuth();
  const isDesktop = useIsDesktopViewport();
  useOverlayLoading(isLoading);

  if (isLoading) return null;

  if (!isSignedIn) {
    // Desktop signs in *over* the workspace: the desk mounts behind a centred
    // modal, blurred and inert, so the thing being unlocked is visible while you
    // unlock it. Mobile has no room for that and gets the full-screen splash.
    if (isDesktop) {
      return (
        <>
          <div inert aria-hidden="true">
            {children}
          </div>
          <DesktopAuthModal />
        </>
      );
    }
    return <SplashScreen />;
  }

  return (
    <div className="relative min-h-dvh bg-black text-[--primary] font-[family-name:var(--font-jakarta)]">
      {/* Capability warnings - ephemeral, non-blocking */}
      {!capabilities.isLoading && capabilities.warnings.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-30">
          <CapabilityBanner warnings={capabilities.warnings} />
        </div>
      )}

      {/* Main content area with proper safe area insets */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Waitlist sheet - modal overlay */}
      <WaitlistSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        target={upgradeTarget ?? undefined}
      />

      {/* Brand watermark - subtle, non-interactive */}
      <div
        className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 text-white/4 text-[length:var(--text-footnote)]
                   tracking-[0.2em] uppercase pointer-events-none select-none"
        aria-hidden="true"
      >
        ordio
      </div>
    </div>
  );
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <CreateLayoutContent>{children}</CreateLayoutContent>
    </Suspense>
  );
}
