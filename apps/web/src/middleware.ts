import { clerkMiddleware } from '@clerk/nextjs/server';

// No routing decisions here any more. This used to redirect signed-in desktop
// users off `/create` to `/studio` based on a user-agent sniff; `/create` is now
// responsive and serves both, so the redirect would only bounce users away from
// the page that already fits them.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
