import { describe, it, expect, afterEach } from 'vitest';
import { resolveReturnOrigin } from '@/lib/checkoutReturnUrl';

/**
 * These guard an open redirect: whatever this function returns becomes the
 * destination a completed Stripe/Paystack checkout sends the user to.
 */

function requestWithOrigin(origin?: string): Request {
  return new Request('https://ordio.app/api/stripe/checkout', {
    method: 'POST',
    headers: origin ? { origin } : {},
  });
}

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('resolveReturnOrigin', () => {
  it('uses the request origin so preview deploys return to themselves', () => {
    expect(resolveReturnOrigin(requestWithOrigin('https://ordio-git-abc.vercel.app'))).toBe(
      'https://ordio-git-abc.vercel.app'
    );
  });

  it('strips any path, query or fragment down to the bare origin', () => {
    expect(resolveReturnOrigin(requestWithOrigin('https://ordio.app/evil?x=1#y'))).toBe(
      'https://ordio.app'
    );
  });

  it('allows http on localhost so local dev checkout still returns', () => {
    expect(resolveReturnOrigin(requestWithOrigin('http://localhost:3000'))).toBe(
      'http://localhost:3000'
    );
  });

  it('rejects plain http on a remote host', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ordio.app';
    expect(resolveReturnOrigin(requestWithOrigin('http://attacker.example'))).toBe(
      'https://ordio.app'
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'not-a-url',
    '',
    '//attacker.example',
  ])('falls back rather than trusting %j', (hostile) => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ordio.app';
    expect(resolveReturnOrigin(requestWithOrigin(hostile))).toBe('https://ordio.app');
  });

  it('falls back to the configured site URL when no origin header is sent', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ordio.app';
    expect(resolveReturnOrigin(requestWithOrigin())).toBe('https://ordio.app');
  });

  it('ignores a malformed NEXT_PUBLIC_SITE_URL and uses the hardcoded fallback', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://evil.example';
    expect(resolveReturnOrigin(requestWithOrigin())).toBe('https://ordio.app');
  });

  it('never returns a value the caller supplied in the body — there is no body path', () => {
    // The signature takes only a Request; there is deliberately no parameter
    // through which a caller could nominate a destination.
    expect(resolveReturnOrigin.length).toBe(1);
  });
});
