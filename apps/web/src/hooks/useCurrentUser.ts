'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth, useQuery, useMutation } from 'convex/react';
import { anyApi } from 'convex/server';
import type { UserTier } from '@/lib/featureGates';

export interface CurrentUser {
  tier: UserTier;
  usageCount: number;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useCurrentUser(): CurrentUser {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(anyApi.users.getMe);
  const upsertUser = useMutation(anyApi.users.upsertUser);

  const upsertedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !upsertedRef.current) {
      upsertedRef.current = true;
      upsertUser().catch(() => {});
    }
    if (!isAuthenticated) {
      upsertedRef.current = false;
    }
  }, [isAuthenticated, upsertUser]);

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
