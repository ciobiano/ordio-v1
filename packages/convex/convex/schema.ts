import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** One Word of a Transcript, as Whisper returns it (seconds). */
export const wordValidator = v.object({
  text: v.string(),
  start: v.number(),
  end: v.number(),
});

/** A Clip proposed from an Episode, as the find-clips route returns it. */
export const clipCandidateValidator = v.object({
  start: v.number(),
  end: v.number(),
  hookText: v.string(),
  rationale: v.string(),
});

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(), // Clerk ID
    email: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    usageCount: v.number(), // Daily usage
    lastResetTime: v.number(), // Timestamp of last usage reset

    // ── Credits ──────────────────────────────────────────────────────────────
    // Optional throughout: rows created before credits shipped have none, and
    // an absent balance must read as "not yet granted" rather than as zero, or
    // existing users would be locked out on deploy. See shared/src/credits.ts.
    /** Current balance. 10 credits = 1 minute of transcription. */
    credits: v.optional(v.number()),
    /** When the one-time welcome grant was given. Absent = never granted. */
    welcomeGrantedAt: v.optional(v.number()),
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

  /**
   * People who ran out of free minutes and asked to be told when more exist.
   *
   * Kept deliberately thin. This is a demand signal, not a CRM: the only
   * questions it needs to answer are how many people hit the ceiling and how
   * to reach them. Anything else is recoverable from the users table.
   */
  waitlist: defineTable({
    /** Clerk tokenIdentifier — everyone who can hit the limit is signed in. */
    tokenIdentifier: v.string(),
    email: v.string(),
    /** What they were trying to do when they hit the wall. */
    reason: v.string(),
    joinedAt: v.number(),
  })
  .index("by_token", ["tokenIdentifier"])
  .index("by_email", ["email"]),

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
  .index("by_expires_at", ["expiresAt"]),

  /**
   * An Episode a person has read, kept so dropping the same file again within
   * EPISODE_RETENTION_MS reopens its Clips without uploading, transcribing or
   * spending Credits a second time. The original file is not kept — a Clip is
   * always cut from the file the person drops.
   */
  episodes: defineTable({
    userId: v.string(), // Clerk tokenIdentifier
    /** name|size|lastModified of the dropped file — how the same file is recognised. */
    fingerprint: v.string(),
    durationSec: v.number(),
    /** Set once Clips are found. */
    candidates: v.optional(v.array(clipCandidateValidator)),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
  .index("by_user_fingerprint", ["userId", "fingerprint"])
  .index("by_expires_at", ["expiresAt"]),

  /**
   * One uploaded part of an Episode. Words live here rather than on the
   * episode row: a 90-minute Transcript is ~600KB, and a Convex document is
   * capped at 1MB.
   */
  episodeChunks: defineTable({
    episodeId: v.id("episodes"),
    userId: v.string(),
    startSec: v.number(),
    durationSec: v.number(),
    storageId: v.id("_storage"),
    /** Chunk-relative Words; set by /api/transcribe once transcribed. */
    words: v.optional(v.array(wordValidator)),
  })
  .index("by_episode", ["episodeId"])
  .index("by_storage_id", ["storageId"]),

  /**
   * Who uploaded a file that /api/transcribe may read. Storage IDs are
   * unguessable, but the route still refuses to transcribe a file the caller
   * did not upload. A claim on a Session's own file is removed when the
   * Session is created; one still standing at `expiresAt` is a file nothing
   * kept, and the sweep deletes it.
   */
  transcriptionUploads: defineTable({
    userId: v.string(),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  })
  .index("by_storage_id", ["storageId"])
  .index("by_expires_at", ["expiresAt"]),
});
