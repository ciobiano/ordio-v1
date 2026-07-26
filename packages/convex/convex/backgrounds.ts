// packages/convex/convex/backgrounds.ts
// User-uploaded background video loops (creator tier).
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireUser } from "./auth";

// Storage cost control: cap per-user custom backgrounds. Revisit after the
// user test if real usage wants more.
const MAX_BACKGROUNDS_PER_USER = 10;
// Server-side ceiling mirrors the client transcode budget (≤2.5MB testing
// spec) with headroom — reject anything that skipped the client transcode.
const MAX_BACKGROUND_BYTES = 4 * 1024 * 1024;
const MAX_BACKGROUND_DURATION_SEC = 11; // ≤10s spec + container rounding

export const uploadBackground = mutation({
  args: {
    storageId: v.id("_storage"),
    label: v.optional(v.string()),
    mediaType: v.union(v.literal("video"), v.literal("image")),
    durationSec: v.optional(v.number()), // required for video, absent for image
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Tier check server-side — never trust the client's gate alone.
    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", user.tokenIdentifier))
      .unique();
    const tier = dbUser?.tier ?? "free";
    if (tier === "free") {
      throw new Error("Custom backgrounds require a Creator subscription");
    }

    if (args.sizeBytes > MAX_BACKGROUND_BYTES) {
      throw new Error("Background exceeds the maximum stored size");
    }
    if (args.mediaType === "video") {
      if (args.durationSec === undefined || args.durationSec <= 0 || args.durationSec > MAX_BACKGROUND_DURATION_SEC) {
        throw new Error("Background must be between 0 and 10 seconds");
      }
    }

    const existing = await ctx.db
      .query("backgroundAssets")
      .withIndex("by_user_id", (q) => q.eq("userId", user.tokenIdentifier))
      .collect();
    if (existing.length >= MAX_BACKGROUNDS_PER_USER) {
      throw new Error(
        `You can store up to ${MAX_BACKGROUNDS_PER_USER} backgrounds — delete one first`
      );
    }

    return await ctx.db.insert("backgroundAssets", {
      userId: user.tokenIdentifier,
      storageId: args.storageId,
      label: args.label,
      mediaType: args.mediaType,
      durationSec: args.durationSec,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    });
  },
});

export const listMyBackgrounds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return [];
    return await ctx.db
      .query("backgroundAssets")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
  },
});

export const getBackgroundUrl = query({
  args: { assetId: v.id("backgroundAssets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset) return null;
    // Ownership check — never expose storage URLs to non-owners
    if (asset.userId !== user.tokenIdentifier) return null;
    return await ctx.storage.getUrl(asset.storageId);
  },
});

export const deleteBackgroundAsset = mutation({
  args: { assetId: v.id("backgroundAssets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset) return;
    if (asset.userId !== user.tokenIdentifier) {
      throw new Error("Not authorized to delete this background");
    }
    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete(assetId);
  },
});
