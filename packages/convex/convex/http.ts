import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Webhook for the renderer to update job status.
 * e.g. POST /updateStatus { jobId, status, renderedVideoId }
 */
http.route({
  path: "/updateStatus",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { jobId, status, renderedVideoId, error } = await request.json();

    if (!jobId || !status) {
      return new Response("Missing jobId or status", { status: 400 });
    }

    // Since http actions can't access DB directly, we'd normally call an internal mutation
    // For now, in Phase 2, we'll just log it. In Phase 4 we implement the internal mutation.
    console.log(`Received status update for ${jobId}: ${status}`);

    // await ctx.runMutation(internal.jobs.internalUpdateStatus, { ... });

    return new Response(null, { status: 200 });
  }),
});

export default http;
