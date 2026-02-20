/**
 * Configuration for Clerk Authentication.
 * 
 * WHY IS THIS HERE?
 * Convex needs to know who to trust. By providing the "Issuer URL" (from Clerk)
 * and the "applicationID" (audience), Convex can verify the JWT tokens sent by the frontend.
 * 
 * LEARNING POINT:
 * This decouples auth from your database. You don't store passwords. 
 * You just verify signatures.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
