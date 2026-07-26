import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(), // Clerk ID
    email: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    usageCount: v.number(), // Daily usage
    lastResetTime: v.number(), // Timestamp of last usage reset
    stripeCustomerId: v.optional(v.string()),
    paystackCustomerCode: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'))
    ),
  })
  .index("by_token", ["tokenIdentifier"])
  .index("by_stripe_customer", ["stripeCustomerId"])
  .index("by_paystack_customer", ["paystackCustomerCode"]),

  backgroundAssets: defineTable({
    userId: v.string(),          // Clerk user ID (tokenIdentifier)
    storageId: v.id("_storage"), // transcoded loop or image in Convex storage
    label: v.optional(v.string()),
    // Optional for backward compat with rows created before images shipped —
    // absent means "video" (every pre-existing row is a transcoded loop).
    mediaType: v.optional(v.union(v.literal("video"), v.literal("image"))),
    durationSec: v.optional(v.number()), // video only — images have no duration
    sizeBytes: v.number(),
    createdAt: v.number(),
  })
  .index("by_user_id", ["userId"]),

  sessions: defineTable({
    userId: v.string(), // Clerk user ID
    storageId: v.id("_storage"), // Convex file storage reference
    mimeType: v.string(), // e.g. "audio/webm"
    durationSec: v.number(), // audio duration in seconds
    transcript: v.array(v.object({
      text: v.string(),
      start: v.number(),
      end: v.number(),
    })), // Word[] from Whisper
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')), // user's tier at creation time
    title: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    expiresAt: v.number(), // Unix timestamp (ms)
    createdAt: v.number(), // Unix timestamp (ms)
  })
  .index("by_user_id", ["userId"])
  .index("by_user_created", ["userId", "createdAt"])
  .index("by_expires_at", ["expiresAt"])
});
