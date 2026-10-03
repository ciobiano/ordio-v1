// packages/convex/convex/transcription.ts
//
// Files /api/transcribe reads from storage instead of from its request body.
// Vercel refuses request bodies over 4.5MB; Convex upload URLs have no size
// limit, so audio goes browser → storage, and the route receives only an ID.
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./auth";
import { wordValidator } from "./schema";

/**
 * How long a claimed upload may wait to be transcribed or become a Session.
 * Transcribing even a 15-minute Recording takes minutes, not hours; a claim
 * still standing after this is a file nothing kept.
 */
const CLAIM_TTL_MS = 2 * 60 * 60 * 1000;

/** The caller's claim on a file, through an Episode chunk or a one-off upload. */
async function ownership(ctx: QueryCtx, storageId: Id<"_storage">, userId: string) {
  const chunk = await ctx.db
    .query("episodeChunks")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .first();
  if (chunk) return chunk.userId === userId ? { chunkId: chunk._id, words: chunk.words ?? null } : null;

  const claim = await ctx.db
    .query("transcriptionUploads")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .first();
  if (claim && claim.userId === userId && claim.expiresAt > Date.now()) {
    return { chunkId: null, words: null };
  }
  return null;
}

/**
 * Record that the caller uploaded this file. First claimer owns it; a file
 * already claimed by someone else, or already part of an Episode, is refused.
 */
export const claimUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireUser(ctx);
    const chunk = await ctx.db
      .query("episodeChunks")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first();
    const existing = await ctx.db
      .query("transcriptionUploads")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first();
    if (chunk || (existing && existing.userId !== user.tokenIdentifier)) {
      throw new Error("Upload not found");
    }
    if (existing) return existing._id;
    return await ctx.db.insert("transcriptionUploads", {
      userId: user.tokenIdentifier,
      storageId,
      expiresAt: Date.now() + CLAIM_TTL_MS,
    });
  },
});

/**
 * A short-lived download URL for a file the caller owns, or null.
 *
 * Called by /api/transcribe with the caller's own token, so ownership is
 * checked against who is asking, not against anything the route asserts.
 * `chunkId` tells the route the Words belong on an Episode chunk; `words`
 * are that chunk's Words if it was already transcribed — a retry after a lost
 * response — so the route can answer without transcribing or billing again.
 */
export const authorize = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireUser(ctx);
    const owned = await ownership(ctx, storageId, user.tokenIdentifier);
    if (!owned) return null;
    const url = await ctx.storage.getUrl(storageId);
    if (!url) return null;
    return { url, chunkId: owned.chunkId, words: owned.words };
  },
});

/**
 * Keep an Episode chunk's Words with the chunk. Written by the route, not the
 * browser, so a transcription that was paid for survives the tab closing
 * before the response arrives.
 */
export const saveChunkWords = mutation({
  args: { chunkId: v.id("episodeChunks"), words: v.array(wordValidator) },
  handler: async (ctx, { chunkId, words }) => {
    const user = await requireUser(ctx);
    const chunk = await ctx.db.get(chunkId);
    if (!chunk || chunk.userId !== user.tokenIdentifier) {
      throw new Error("Chunk not found");
    }
    await ctx.db.patch(chunkId, { words });
  },
});

/** Delete claims that nothing kept, and the files behind them. */
export const cleanupExpiredUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("transcriptionUploads")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", Date.now()))
      .collect();

    let deleted = 0;
    for (const claim of expired) {
      try {
        // A file already gone is not a failure — the claim still has to go.
        await ctx.storage.delete(claim.storageId).catch(() => undefined);
        await ctx.db.delete(claim._id);
        deleted++;
      } catch (err) {
        console.error(`cleanupExpiredUploads: failed on claim ${claim._id}`, err);
        // Continue processing remaining records rather than aborting the run
      }
    }
    return { deleted };
  },
});
