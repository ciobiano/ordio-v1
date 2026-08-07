'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth, useQuery, useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { UserTier } from '@/lib/featureGates';

export interface CurrentUser {
  tier: UserTier;
  usageCount: number;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useCurrentUser(): CurrentUser {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);
  const ensureWelcomeGrant = useMutation(api.credits.ensureWelcomeGrant);

  const upsertedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !upsertedRef.current) {
      upsertedRef.current = true;

      // Strictly ordered: the grant looks the user up by token and no-ops when
      // the row is missing, so provisioning has to finish first or a brand-new
      // signup silently gets no welcome grant.
      //
      // Idempotent — guarded on `welcomeGrantedAt` — so running it on every
      // sign-in is safe.
      void (async () => {
        try {
          await upsertUser();
          await ensureWelcomeGrant();
        } catch {
          // Provisioning is best-effort. A failure here leaves the user with
          // whatever balance they had; the next sign-in retries.
        }
      })();
    }
    if (!isAuthenticated) {
      upsertedRef.current = false;
    }
  }, [isAuthenticated, upsertUser, ensureWelcomeGrant]);

  if (!isAuthenticated) {
    return { tier: 'free', usageCount: 0, isAuthenticated: false, isLoading: authLoading };
  }

  return {
    tier: (me?.tier ?? 'free') as UserTier,
    usageCount: me?.usageCount ?? 0,
    isAuthenticated: true,
    isLoading: authLoading || me === undefined,
  };
}
