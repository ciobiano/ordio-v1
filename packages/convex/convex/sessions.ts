// packages/convex/convex/sessions.ts
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser, requireUser } from "./auth";

const RETENTION_MS: Record<string, number> = {
  free:    24 * 60 * 60 * 1000,       // 24 hours
  creator: 30 * 24 * 60 * 60 * 1000,  // 30 days
  pro:     30 * 24 * 60 * 60 * 1000,  // 30 days (same as creator)
};

function buildFallbackTitle(createdAt: number): string {
  const date = new Date(createdAt);
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `Recording ${formatted}`;
}

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

export const listMySessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return [];

    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();

    return sessions
      .filter((session) => session.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((session) => ({
        id: session._id,
        name: session.title?.trim() || buildFallbackTitle(session.createdAt),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt ?? session.createdAt,
        expiresAt: session.expiresAt,
        durationMs: Math.round(session.durationSec * 1000),
      }));
  },
});

export const listMySessionsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const results = await ctx.db
      .query("sessions")
      .withIndex("by_user_created", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .paginate(paginationOpts);

    return {
      ...results,
      page: results.page.map((session) => ({
        id: session._id,
        name: session.title?.trim() || buildFallbackTitle(session.createdAt),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt ?? session.createdAt,
        expiresAt: session.expiresAt,
        durationMs: Math.round(session.durationSec * 1000),
      })),
    };
  },
});

export const renameSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    title: v.string(),
  },
  handler: async (ctx, { sessionId, title }) => {
    const identity = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      throw new Error("Title is required");
    }

    const updatedAt = Date.now();
    await ctx.db.patch(sessionId, {
      title: normalizedTitle,
      updatedAt,
    });

    return {
      id: sessionId,
      name: normalizedTitle,
      updatedAt,
    };
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const identity = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    await ctx.storage.delete(session.storageId);
    await ctx.db.delete(sessionId);
    return { success: true };
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
