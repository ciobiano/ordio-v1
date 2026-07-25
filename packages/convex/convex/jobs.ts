import { mutation } from "./_generated/server";
import { requireUser } from "./auth";

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
