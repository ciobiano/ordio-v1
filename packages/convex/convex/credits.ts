/**
 * The credit ledger.
 *
 * Every mutation here runs inside a Convex transaction, which is what makes the
 * balance safe: two transcriptions starting at once cannot both read the same
 * balance and both succeed. The arithmetic itself lives in @Ordio/shared so it
 * can be unit-tested and so the UI agrees with the server about what a minute
 * costs.
 *
 * The spend protocol is hold-then-settle:
 *   1. `holdForTranscription` reserves credits from the duration the client
 *      reports, because only the client knows it before the audio is uploaded.
 *   2. The work happens.
 *   3. `settleTranscription` reconciles against the duration Whisper actually
 *      reports, refunding an over-estimate or collecting a shortfall.
 *
 * Step 3 is what makes step 1 safe to trust a client for. Under-reporting buys
 * exactly one transcription before the balance goes negative and the next hold
 * is refused.
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./auth";
import {
  WELCOME_GRANT_CREDITS,
  MONTHLY_ALLOWANCE,
  creditsForSeconds,
  enhanceCreditsForSeconds,
  minutesFromCredits,
  applyDebit,
  settleHold,
  type BillingProcessor,
} from "@Ordio/shared";
import type { Doc } from "./_generated/dataModel";

/** A month, for refill purposes. Calendar months differ; billing does not care. */
const REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A row's balance, treating "never granted" as zero rather than as unlimited.
 *
 * Rows predate credits, so `credits` is genuinely absent for existing users.
 * `ensureWelcomeGrant` is what turns that absence into a starting balance.
 */
function balanceOf(user: Doc<"users">): number {
  return user.credits ?? 0;
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/**
 * The signed-in user's balance, in both units.
 *
 * Returns null rather than throwing for a signed-out caller, so the UI can
 * render a loading or logged-out state instead of an error.
 */
export const getMyCredits = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    const credits = balanceOf(user);
    return {
      credits,
      minutes: minutesFromCredits(credits),
      tier: user.tier,
      monthlyAllowance: user.monthlyAllowance ?? null,
      welcomeGranted: user.welcomeGrantedAt !== undefined,
    };
  },
});

// ─── Granting ─────────────────────────────────────────────────────────────────

/**
 * Give the one-time welcome grant, if it has never been given.
 *
 * Idempotent by design — it is called on app load, which happens constantly.
 * `welcomeGrantedAt` is the flag rather than "balance is zero", so a user who
 * legitimately spends down to zero is not silently re-granted 30 free minutes
 * every time they open the app.
 */
export const ensureWelcomeGrant = mutation({
  args: {},
  handler: async (ctx): Promise<{ granted: boolean; credits: number }> => {
    const identity = await requireUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return { granted: false, credits: 0 };

    if (user.welcomeGrantedAt !== undefined) {
      return { granted: false, credits: balanceOf(user) };
    }

    const credits = balanceOf(user) + WELCOME_GRANT_CREDITS;
    await ctx.db.patch(user._id, { credits, welcomeGrantedAt: Date.now() });
    return { granted: true, credits };
  },
});

/**
 * Set a subscriber's monthly allowance and credit the first cycle.
 *
 * Internal, and called from the webhook that took the payment — never from the
 * client, and never keyed on the market the browser claims to be in. The
 * processor that charged the card is the only trustworthy signal of which
 * allowance was actually paid for.
 */
export const setMonthlyAllowance = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    processor: v.union(v.literal("stripe"), v.literal("paystack")),
  },
  handler: async (ctx, { tokenIdentifier, processor }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (!user) return;

    const allowance = MONTHLY_ALLOWANCE[processor as BillingProcessor];
    await ctx.db.patch(user._id, {
      monthlyAllowance: allowance,
      // Top up rather than overwrite: a user who subscribes mid-cycle keeps
      // whatever is left of their welcome grant. They paid for the allowance,
      // not for the removal of what they already had.
      credits: balanceOf(user) + allowance,
      lastRefillAt: Date.now(),
    });
  },
});

/**
 * Stop refilling a lapsed subscriber, without confiscating their balance.
 *
 * Clearing `monthlyAllowance` is what ends the subscription; the credits they
 * already paid for stay theirs to spend. Taking them back would be charging for
 * a month and then withdrawing it.
 */
export const clearMonthlyAllowance = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (!user) return;
    await ctx.db.patch(user._id, { monthlyAllowance: undefined });
  },
});

/**
 * Credit a subscriber's monthly allowance when a cycle has elapsed.
 *
 * Driven from app load rather than a cron so a dormant account does not
 * accumulate months of unused credits it never asked for. Guarded on elapsed
 * time, so calling it repeatedly within a cycle does nothing.
 */
export const refillIfDue = mutation({
  args: {},
  handler: async (ctx): Promise<{ refilled: boolean; credits: number }> => {
    const identity = await requireUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return { refilled: false, credits: 0 };

    const allowance = user.monthlyAllowance;
    if (!allowance) return { refilled: false, credits: balanceOf(user) };

    const now = Date.now();
    const last = user.lastRefillAt ?? 0;
    if (now - last < REFILL_INTERVAL_MS) {
      return { refilled: false, credits: balanceOf(user) };
    }

    // Set rather than accumulate: an allowance is what you get each month, not
    // something that stockpiles indefinitely while you are not using it. A
    // balance already above the allowance (from a recent top-up) is left alone.
    const credits = Math.max(balanceOf(user), allowance);
    await ctx.db.patch(user._id, { credits, lastRefillAt: now });
    return { refilled: true, credits };
  },
});

// ─── Spending ─────────────────────────────────────────────────────────────────

/**
 * Reserve credits for a transcription the caller is about to run.
 *
 * `estimatedSeconds` comes from the client and is therefore not trusted for
 * anything but sizing the hold — `settleTranscription` corrects it against
 * Whisper's own duration.
 */
export const holdForTranscription = mutation({
  args: { estimatedSeconds: v.number(), enhance: v.optional(v.union(v.literal("clean"), v.literal("hd"))) },
  handler: async (
    ctx,
    { estimatedSeconds, enhance }
  ): Promise<{ allowed: boolean; held: number; credits: number; minutes: number }> => {
    const identity = await requireUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return { allowed: false, held: 0, credits: 0, minutes: 0 };

    const cost =
      creditsForSeconds(estimatedSeconds) +
      (enhance ? enhanceCreditsForSeconds(estimatedSeconds, enhance) : 0);

    // A zero-cost hold still has to be refused when the balance is empty,
    // otherwise a caller reporting 0 seconds transcribes for free.
    const outcome = applyDebit(balanceOf(user), Math.max(cost, 1));
    if (!outcome.allowed) {
      return { allowed: false, held: 0, credits: balanceOf(user), minutes: minutesFromCredits(balanceOf(user)) };
    }

    await ctx.db.patch(user._id, { credits: outcome.balance });
    return {
      allowed: true,
      held: outcome.charged,
      credits: outcome.balance,
      minutes: minutesFromCredits(outcome.balance),
    };
  },
});

/**
 * Reconcile a hold against what the work actually cost.
 *
 * Call with `actualSeconds: 0` when the work failed — the whole hold comes
 * back. Nobody should pay for a transcription that errored.
 */
export const settleTranscription = mutation({
  args: {
    held: v.number(),
    actualSeconds: v.number(),
    enhance: v.optional(v.union(v.literal("clean"), v.literal("hd"))),
  },
  handler: async (ctx, { held, actualSeconds, enhance }): Promise<{ credits: number }> => {
    const identity = await requireUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return { credits: 0 };

    const actualCost =
      creditsForSeconds(actualSeconds) +
      (enhance ? enhanceCreditsForSeconds(actualSeconds, enhance) : 0);

    const credits = settleHold(balanceOf(user), held, actualCost);
    await ctx.db.patch(user._id, { credits });
    return { credits };
  },
});
