import { mutation, query } from "./_generated/server";
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
