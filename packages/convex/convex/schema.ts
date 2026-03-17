import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jobs: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("uploading"),
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    config: v.any(), // Validated by Zod at runtime, stored as JSON
    storageId: v.string(), // Audio file ID
    renderedVideoId: v.optional(v.string()), // Result MP4 ID
    error: v.optional(v.string())
  })
  .index("by_user_id", ["userId"])
  .index("by_status", ["status"]),

  users: defineTable({
    tokenIdentifier: v.string(), // Clerk ID
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
  .index("by_paystack_customer", ["paystackCustomerCode"])
});
