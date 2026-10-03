// packages/convex/convex/episodes.ts
//
// Episodes a person has read, kept for EPISODE_RETENTION_MS so dropping the
// same file again reopens its Clips — or resumes a run that stopped — without
// uploading, transcribing or spending Credits twice.
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./auth";
import { clipCandidateValidator } from "./schema";

const EPISODE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Saved chunks whose starts are this close are the same window, uploaded twice. */
const SAME_WINDOW_SEC = 0.5;

export type SavedChunk = { startSec: number; durationSec: number; words: Array<{ text: string; start: number; end: number }> | null };

/**
 * One chunk per window. A window can be saved twice: a run is dropped while a
 * chunk is mid-transcription, the file is dropped again before the server has
 * saved that chunk's Words, and the new run uploads the window afresh. Merging
 * both would double every Word in it, so the copy with Words wins.
 */
export function onePerWindow(chunks: SavedChunk[]): SavedChunk[] {
  const sorted = [...chunks].sort(
    (a, b) => a.startSec - b.startSec || Number(b.words !== null) - Number(a.words !== null)
  );
  const kept: SavedChunk[] = [];
  for (const chunk of sorted) {
    const last = kept.at(-1);
    if (last && Math.abs(chunk.startSec - last.startSec) <= SAME_WINDOW_SEC) {
      if (last.words === null && chunk.words !== null) kept[kept.length - 1] = chunk;
      continue;
    }
    kept.push(chunk);
  }
  return kept;
}

async function ownedEpisode(ctx: MutationCtx, episodeId: Id<"episodes">, userId: string) {
  const episode = await ctx.db.get(episodeId);
  if (!episode || episode.userId !== userId || episode.expiresAt < Date.now()) {
    throw new Error("Episode not found");
  }
  return episode;
}

/**
 * The caller's live Episode for this file, with every saved chunk, or null.
 *
 * A mutation rather than a query because the client calls it once,
 * imperatively, at the start of a run — it never needs to stay subscribed.
 */
export const resume = mutation({
  args: { fingerprint: v.string() },
  handler: async (ctx, { fingerprint }) => {
    const user = await requireUser(ctx);
    const episode = await ctx.db
      .query("episodes")
      .withIndex("by_user_fingerprint", (q) =>
        q.eq("userId", user.tokenIdentifier).eq("fingerprint", fingerprint)
      )
      .order("desc")
      .first();
    if (!episode || episode.expiresAt < Date.now()) return null;

    /* Using an Episode keeps it: the 7 days run from the last time it was
       opened, so a run resumed on day 6 is not swept away underneath itself. */
    await ctx.db.patch(episode._id, { expiresAt: Date.now() + EPISODE_RETENTION_MS });

    const chunks = await ctx.db
      .query("episodeChunks")
      .withIndex("by_episode", (q) => q.eq("episodeId", episode._id))
      .collect();
    return {
      episodeId: episode._id,
      durationSec: episode.durationSec,
      candidates: episode.candidates ?? null,
      chunks: onePerWindow(
        chunks.map((c) => ({
          startSec: c.startSec,
          durationSec: c.durationSec,
          words: c.words ?? null,
        }))
      ),
    };
  },
});

export const create = mutation({
  args: { fingerprint: v.string(), durationSec: v.number() },
  handler: async (ctx, { fingerprint, durationSec }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("episodes", {
      userId: user.tokenIdentifier,
      fingerprint,
      durationSec,
      expiresAt: now + EPISODE_RETENTION_MS,
      createdAt: now,
    });
  },
});

/**
 * Attach an uploaded chunk to an Episode. Returns the chunk's id; the file
 * becomes transcribable by its owner through `transcription.authorize`.
 */
export const addChunk = mutation({
  args: {
    episodeId: v.id("episodes"),
    startSec: v.number(),
    durationSec: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ownedEpisode(ctx, args.episodeId, user.tokenIdentifier);

    // A file can belong to one owner only — never re-home someone else's upload.
    const attached = await ctx.db
      .query("episodeChunks")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    const claim = await ctx.db
      .query("transcriptionUploads")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    if (attached || (claim && claim.userId !== user.tokenIdentifier)) {
      throw new Error("Upload not found");
    }
    /* The browser claims each chunk the moment it lands, so one that never
       gets attached is swept with the other unclaimed uploads. Attaching
       hands it from the claim to the Episode, whose expiry governs it now. */
    if (claim) await ctx.db.delete(claim._id);

    return await ctx.db.insert("episodeChunks", {
      episodeId: args.episodeId,
      userId: user.tokenIdentifier,
      startSec: args.startSec,
      durationSec: args.durationSec,
      storageId: args.storageId,
    });
  },
});

export const saveCandidates = mutation({
  args: { episodeId: v.id("episodes"), candidates: v.array(clipCandidateValidator) },
  handler: async (ctx, { episodeId, candidates }) => {
    const user = await requireUser(ctx);
    await ownedEpisode(ctx, episodeId, user.tokenIdentifier);
    await ctx.db.patch(episodeId, { candidates });
  },
});

/** Delete expired Episodes: every chunk's file, every chunk row, then the Episode. */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("episodes")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", Date.now()))
      .collect();

    let deleted = 0;
    for (const episode of expired) {
      try {
        const chunks = await ctx.db
          .query("episodeChunks")
          .withIndex("by_episode", (q) => q.eq("episodeId", episode._id))
          .collect();
        for (const chunk of chunks) {
          // A file already gone is not a failure — the row still has to go.
          await ctx.storage.delete(chunk.storageId).catch(() => undefined);
          await ctx.db.delete(chunk._id);
        }
        await ctx.db.delete(episode._id);
        deleted++;
      } catch (err) {
        console.error(`cleanupExpired: failed to delete episode ${episode._id}`, err);
        // Continue processing remaining records rather than aborting the run
      }
    }
    return { deleted };
  },
});
