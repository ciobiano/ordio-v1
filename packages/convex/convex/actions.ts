"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const scheduleRender = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getJob, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const rendererUrl = process.env.RENDERER_URL;
    if (!rendererUrl) {
      throw new Error("RENDERER_URL not configured");
    }

    try {
      // call renderer
      const response = await fetch(`${rendererUrl}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.config),
      });

      if (!response.ok) {
        throw new Error(`Renderer error: ${response.statusText}`);
      }

      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "processing",
      });
      
    } catch (error: any) {
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "failed",
        error: error.message,
      });
    }
  },
});
