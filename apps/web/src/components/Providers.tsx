'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/create" signUpFallbackRedirectUrl="/create">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
