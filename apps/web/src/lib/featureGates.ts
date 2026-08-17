/**
 * The gate table itself moved to @Ordio/shared so the Convex backend reads the
 * same rule the UI does — see the reasoning in `packages/shared/src/featureGates.ts`.
 *
 * This re-export stays because ~24 components import `FeatureKey` from
 * `@/lib/featureGates`, and the app-relative path is the more natural one to
 * reach for from inside `apps/web`.
 */
export {
  FEATURE_GATES,
  tierHasAccess,
  type FeatureKey,
  type UserTier,
} from '@Ordio/shared/featureGates';
