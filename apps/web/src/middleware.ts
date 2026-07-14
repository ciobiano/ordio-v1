import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { isMobileUserAgent } from '@/lib/deviceDetect';

// Signed-in desktop users land on /create only via Clerk's static
// signInFallbackRedirectUrl. Skip the mobile flow entirely for them —
// redirect straight to /studio before /create ever renders.
export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === '/create') {
    const { userId } = await auth();
    const desktop = !isMobileUserAgent(req.headers.get('user-agent'));
    if (userId && desktop) {
      return NextResponse.redirect(new URL('/studio', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
