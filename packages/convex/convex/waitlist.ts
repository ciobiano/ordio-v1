/**
 * The waitlist.
 *
 * What replaced checkout. When someone burns through their welcome grant they
 * are not shown a price — there isn't one — they are asked whether they want to
 * be told if more minutes ever exist. That question is the only thing here.
 *
 * The table is deliberately thin: this is a demand signal, not a CRM. The two
 * questions worth answering are *how many people hit the ceiling* and *how to
 * reach them*, and both are visible from a Convex dashboard query. Anything
 * richer belongs in whatever tool eventually sends the email.
 *
 * Everyone who can reach this is signed in — the credit limit only exists for
 * authenticated users — so `tokenIdentifier` is always available and is the
 * natural identity. Email is still collected separately because a Clerk account
 * can be an OAuth identity whose address we would otherwise have to go and ask
 * Clerk for.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./auth";

/**
 * Whether the signed-in user is already on the list.
 *
 * `null` for a signed-out or still-loading viewer, so the UI can hold a neutral
 * state rather than flashing "join" at someone who already did. Same convention
 * as `credits.getMyCredits`.
 */
export const amIOnTheWaitlist = query({
  args: {},
  handler: async (ctx): Promise<boolean | null> => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return null;

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    return existing !== null;
  },
});

/**
 * Put the signed-in user on the waitlist.
 *
 * `reason` records what they were doing when they hit the wall — today that is
 * always running out of transcription minutes, but the export limit and any
 * future ceiling would land here too, and knowing which wall people hit is the
 * entire value of the signal.
 */
export const joinWaitlist = mutation({
  args: {
    email: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { email, reason }): Promise<{ joined: boolean }> => {
    const identity = await requireUser(ctx);

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Idempotent: a repeat join is a no-op, not an update.
    //
    // The first row is deliberately left exactly as it was. `joinedAt` is only
    // meaningful as the moment someone first hit a ceiling — refreshing it on
    // every re-open would flatten the timeline into "whenever people last
    // opened the sheet", which answers no question worth asking. `reason` is
    // preserved for the same reason: the first wall someone hit is the signal,
    // and later ones are noise against it.
    if (existing) return { joined: false };

    await ctx.db.insert("waitlist", {
      tokenIdentifier: identity.tokenIdentifier,
      email,
      reason,
      joinedAt: Date.now(),
    });

    return { joined: true };
  },
});
