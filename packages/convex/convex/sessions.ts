// packages/convex/convex/sessions.ts
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./auth";

const RETENTION_MS: Record<string, number> = {
  free:    24 * 60 * 60 * 1000,       // 24 hours
  creator: 30 * 24 * 60 * 60 * 1000,  // 30 days
  pro:     30 * 24 * 60 * 60 * 1000,  // 30 days (same as creator)
};

export const createSession = mutation({
  args: {
    storageId:   v.id("_storage"),
    mimeType:    v.string(),
    durationSec: v.number(),
    transcript:  v.array(v.object({
      text:  v.string(),
      start: v.number(),
      end:   v.number(),
    })),
    // tier is no longer accepted from the client; it is looked up server-side
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Look up authoritative tier from the users table — never trust the client
    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", user.tokenIdentifier))
      .unique();
    const tier = dbUser?.tier ?? "free";

    const now = Date.now();
    const retention = RETENTION_MS[tier] ?? RETENTION_MS.free;

    return await ctx.db.insert("sessions", {
      userId:      user.tokenIdentifier,
      storageId:   args.storageId,
      mimeType:    args.mimeType,
      durationSec: args.durationSec,
      transcript:  args.transcript,
      tier,
      expiresAt:   now + retention,
      createdAt:   now,
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    // Ownership check — prevent cross-user session access
    if (session.userId !== user.tokenIdentifier) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  },
});

export const getAudioUrl = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    // Ownership check — never expose storage URLs to non-owners
    if (session.userId !== user.tokenIdentifier) return null;
    return await ctx.storage.getUrl(session.storageId);
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .collect();

    let deleted = 0;
    for (const session of expired) {
      try {
        await ctx.storage.delete(session.storageId);
        await ctx.db.delete(session._id);
        deleted++;
      } catch (err) {
        console.error(
          `cleanupExpired: failed to delete session ${session._id}`,
          err
        );
        // Continue processing remaining records rather than aborting the run
      }
    }

    return { deleted };
  },
});
