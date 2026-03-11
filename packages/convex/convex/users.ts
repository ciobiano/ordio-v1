import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./auth";

const FREE_TIER_DAILY_LIMIT = 3;

export const upsertUser = mutation({
  handler: async (ctx) => {
    const identity = await requireUser(ctx);
    const tokenIdentifier = identity.tokenIdentifier;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (existing) return;

    await ctx.db.insert("users", {
      tokenIdentifier,
      tier: "free",
      usageCount: 0,
      lastResetTime: Date.now(),
    });
  },
});

export const getMe = query({
  handler: async (ctx): Promise<{
    tier: 'free' | 'creator' | 'pro';
    usageCount: number;
    lastResetTime: number;
  } | null> => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    return { tier: user.tier, usageCount: user.usageCount, lastResetTime: user.lastResetTime };
  },
});

export const checkAndIncrementExport = mutation({
  handler: async (ctx): Promise<{ allowed: boolean; remaining: number }> => {
    const identity = await requireUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return { allowed: true, remaining: FREE_TIER_DAILY_LIMIT - 1 };
    }

    if (user.tier !== "free") {
      await ctx.db.patch(user._id, { usageCount: user.usageCount + 1 });
      return { allowed: true, remaining: Infinity };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const needsReset = user.lastResetTime < startOfToday.getTime();
    const currentCount = needsReset ? 0 : user.usageCount;

    if (currentCount >= FREE_TIER_DAILY_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    await ctx.db.patch(user._id, {
      usageCount: currentCount + 1,
      lastResetTime: needsReset ? Date.now() : user.lastResetTime,
    });

    return { allowed: true, remaining: FREE_TIER_DAILY_LIMIT - (currentCount + 1) };
  },
});

/**
 * INTERNAL: Called by webhook HTTP actions to promote/downgrade a user's tier.
 * Looks up by tokenIdentifier (Clerk ID stored in payment metadata).
 */
export const setTier = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'))
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (!user) {
      await ctx.db.insert("users", {
        tokenIdentifier: args.tokenIdentifier,
        tier: args.tier,
        usageCount: 0,
        lastResetTime: Date.now(),
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
      });
      return;
    }

    await ctx.db.patch(user._id, {
      tier: args.tier,
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
    });
  },
});

/**
 * INTERNAL: Store the payment provider's customer ID after first checkout.
 */
export const setCustomerId = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    stripeCustomerId: v.optional(v.string()),
    paystackCustomerCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      paystackCustomerCode: args.paystackCustomerCode,
    });
  },
});

/**
 * INTERNAL: Lookup user by Stripe customer ID (for cancellation webhook).
 */
export const getByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();
  },
});

/**
 * INTERNAL: Lookup user by Paystack customer code (for cancellation webhook).
 */
export const getByPaystackCustomer = internalQuery({
  args: { paystackCustomerCode: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_paystack_customer", (q) => q.eq("paystackCustomerCode", args.paystackCustomerCode))
      .unique();
  },
});
