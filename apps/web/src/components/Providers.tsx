'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NavigationTransition } from './NavigationTransition';
import { ScrollReveal } from './ScrollReveal';
import type { ReactNode } from 'react';

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <ClerkProvider signInFallbackRedirectUrl="/create" signUpFallbackRedirectUrl="/create">
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <TooltipProvider>
            <ScrollReveal />
            <NavigationTransition>
              {children}
            </NavigationTransition>
          </TooltipProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ThemeProvider>
  );
}
