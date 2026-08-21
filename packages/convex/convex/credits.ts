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
 *
 * With nothing for sale, the ledger stopped being a monetisation lever and
 * became the spend cap. The welcome grant is now the only way credits ever
 * enter an account, which bounds what any one signup can ever cost us to a
 * single grant's worth of Whisper. The subscription refill that used to live
 * here went out with the checkout routes — no processor can set an allowance
 * any more, so nothing could ever have triggered it.
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./auth";
import {
  WELCOME_GRANT_CREDITS,
  creditsForSeconds,
  enhanceCreditsForSeconds,
  minutesFromCredits,
  applyDebit,
  settleHold,
} from "@Ordio/shared";
import type { Doc } from "./_generated/dataModel";

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
 * Set an account's balance by hand.
 *
 * `internalMutation`, so it has no public surface at all — no browser can
 * reach it, only the CLI or dashboard with a deploy key. That is the whole
 * reason it is safe to have a function that mints credits: the boundary is the
 * deployment credential, not an auth check that could be got around.
 *
 * It exists because a balance can legitimately end up somewhere no user action
 * can recover from. A shortfall settle is allowed to push the balance below
 * zero on purpose — it is what stops an under-reporting client from getting
 * free work — but an account stuck there is refused every future hold, and
 * nothing in the product can lift it. Support needs a lever.
 *
 *   npx convex run credits:setBalance '{"email":"a@b.c","credits":300}' --prod
 */
export const setBalance = internalMutation({
  args: { email: v.string(), credits: v.number() },
  handler: async (ctx, { email, credits }): Promise<{ email: string; before: number; after: number }> => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .unique();

    if (!user) throw new Error(`No user with email ${email}`);

    const before = balanceOf(user);
    await ctx.db.patch(user._id, { credits });
    return { email, before, after: credits };
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
