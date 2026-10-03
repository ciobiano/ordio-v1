// packages/convex/convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  internal.sessions.cleanupExpired,
  {}
);

crons.interval(
  "cleanup expired episodes",
  { hours: 1 },
  internal.episodes.cleanupExpired,
  {}
);

crons.interval(
  "cleanup unclaimed transcription uploads",
  { hours: 1 },
  internal.transcription.cleanupExpiredUploads,
  {}
);

export default crons;
