import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Gets the current authenticated user's ID.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity;
}

/**
 * Throws if the user is not authenticated.
 * Returns the user identity.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthenticated: Please log in to perform this action.");
  }
  return user;
}
