// apps/web/src/app/create/layout.tsx
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
import { AuthGate, UpgradeSheet, OnboardingDialog } from '@/components/soul';
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
    return <AuthGate />;
  }

  return (
    <div className="min-h-dvh bg-black text-[--primary] font-[family-name:var(--font-jakarta)]">
      {!capabilities.isLoading && <CapabilityBanner warnings={capabilities.warnings} />}

      {children}

      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
        onUpgrade={() =>
          startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))
        }
      />

      <OnboardingDialog />

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
