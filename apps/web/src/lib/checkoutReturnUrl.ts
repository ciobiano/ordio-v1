/**
 * Where a payment provider sends the user back to after checkout.
 *
 * This used to be a `returnUrl` field on the request body, interpolated
 * straight into Stripe's `success_url` and Paystack's `callback_url`. That is
 * an open redirect: anything the caller puts in the body becomes a destination
 * our own checkout flow vouches for, which is exactly the shape of a payment
 * phishing page ("your card was declined, re-enter it here") reached through a
 * genuine Ordio session.
 *
 * The client only ever sent `window.location.origin`, so nothing is lost by
 * refusing to take the value from the caller at all. The origin is derived from
 * the request itself, which keeps Vercel preview deployments returning to the
 * preview they started on rather than to production.
 */

/** Only these may ever be returned. `http` is allowed solely for localhost. */
function isTrustedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

/** Last resort when the request carries no usable origin of its own. */
const FALLBACK_ORIGIN = 'https://ordio.app';

/**
 * The origin to send the user back to, derived server-side.
 *
 * Prefers the request's own `origin` header (set by the browser on the fetch
 * that reaches us, and correct on preview deployments), then the configured
 * site URL, then a hardcoded production fallback. Fails closed: a header that
 * is missing, malformed, or not https simply falls through to the next source
 * rather than being trusted.
 */
export function resolveReturnOrigin(request: Request): string {
  const header = request.headers.get('origin');
  if (header && isTrustedOrigin(header)) return new URL(header).origin;

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && isTrustedOrigin(configured)) return new URL(configured).origin;

  return FALLBACK_ORIGIN;
}
