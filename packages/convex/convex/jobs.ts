import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./auth";
import { JobConfigSchema } from "@Ordio/shared/schemas";

// Constants
const DAILY_LIMIT_ANON = 3;
const DAILY_LIMIT_AUTH = 20;

/**
 * Generates a signed URL for uploading audio.
 * Requires authentication.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a new render job.
 * Validates configuration and checks rate limits.
 */
export const createJob = mutation({
  args: {
    config: v.any(), // Validated manually with Zod
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = user.tokenIdentifier;

    // 1. Zod Validation
    const configParse = JobConfigSchema.safeParse(args.config);
    if (!configParse.success) {
      throw new Error("Invalid job configuration: " + configParse.error.message);
    }
    const config = configParse.data;

    // 2. Rate Limiting Check
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const userRecord = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", userId))
      .first();

    if (userRecord) {
      // Reset if new day
      if (userRecord.lastResetTime < startOfDay.getTime()) {
        await ctx.db.patch(userRecord._id, {
          usageCount: 0,
          lastResetTime: now,
        });
        userRecord.usageCount = 0;
      }

      if (userRecord.usageCount >= DAILY_LIMIT_AUTH) {
        throw new Error("Daily export limit reached. Please try again tomorrow.");
      }

      // Increment usage
      await ctx.db.patch(userRecord._id, {
        usageCount: userRecord.usageCount + 1,
      });
    } else {
      // First time user
      await ctx.db.insert("users", {
        tokenIdentifier: userId,
        usageCount: 1,
        lastResetTime: now,
      });
    }

    // 3. Create Job
    const jobId = await ctx.db.insert("jobs", {
      userId,
      status: "pending",
      config: config,
      storageId: args.storageId,
    });

    // TODO: In Phase 4, we will schedule the external render action here
    // 4. Trigger Async Render
    await ctx.scheduler.runAfter(0, internal.actions.scheduleRender, { jobId });

    return jobId;
  },
});

/**
 * Lists the latest jobs for the current user.
 */
export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("jobs")
      .withIndex("by_user_id", (q) => q.eq("userId", user.tokenIdentifier))
      .order("desc")
      .take(20);
  },
});

/**
 * INTERNAL: Used by actions to fetch job details.
 */
export const getJob = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * INTERNAL: Used by actions to update job status.
 */
export const updateStatus = internalMutation({
  args: { 
    jobId: v.id("jobs"),
    status: v.union(v.literal("pending"), v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
    renderedVideoId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { jobId, ...patch } = args;
    await ctx.db.patch(jobId, patch);
  },
});
