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
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const retention = RETENTION_MS[args.tier] ?? RETENTION_MS.free;

    return await ctx.db.insert("sessions", {
      userId:      user.tokenIdentifier,
      storageId:   args.storageId,
      mimeType:    args.mimeType,
      durationSec: args.durationSec,
      transcript:  args.transcript,
      tier:        args.tier,
      expiresAt:   now + retention,
      createdAt:   now,
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  },
});

export const getAudioUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
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

    await Promise.all(
      expired.map(async (session) => {
        await ctx.storage.delete(session.storageId);
        await ctx.db.delete(session._id);
      })
    );

    return { deleted: expired.length };
  },
});
