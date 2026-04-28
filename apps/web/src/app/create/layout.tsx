// apps/web/src/app/create/layout.tsx
// HIG-compliant layout: minimal chrome, content-first, proper safe areas
'use client';

import { Suspense } from 'react';
import { useUIStore } from '@/stores';
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useCheckout } from '@/hooks/billing/useCheckout';
import { usePaymentRedirect } from '@/hooks/billing/usePaymentRedirect';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { CapabilityBanner } from '@/components/primitives';
import { UpgradeSheet } from '@/components/soul';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { useOverlayLoading } from '@/components/NavigationTransition';

function CreateLayoutContent({ children }: { children: React.ReactNode }) {
  const { upgradeTarget, setUpgradeTarget } = useUIStore();
  const capabilities = useCapabilities();
  const { isLoading } = useCurrentUser();
  const { isSignedIn } = useAuth();
  useOverlayLoading(isLoading);
  const { startCheckout } = useCheckout();

  usePaymentRedirect();

  if (isLoading) return null;

  if (!isSignedIn) {
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

      {/* Upgrade sheet - modal overlay */}
      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : (upgradeTarget ?? undefined)}
        onUpgrade={() =>
          startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))
        }
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
