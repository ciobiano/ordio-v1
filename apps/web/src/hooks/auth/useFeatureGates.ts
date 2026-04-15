'use client';

import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { FEATURE_GATES, tierHasAccess, type FeatureKey, type UserTier } from '@/lib/featureGates';

export function useFeatureGates(): {
  isLocked: (feature: FeatureKey) => boolean;
  tier: UserTier;
} {
  const { tier } = useCurrentUser();

  return {
    tier,
    isLocked: (feature: FeatureKey) => !tierHasAccess(tier, FEATURE_GATES[feature]),
  };
}
