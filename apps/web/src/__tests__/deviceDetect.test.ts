import { describe, it, expect } from 'vitest';
import { isMobileUserAgent } from '@/lib/deviceDetect';

describe('isMobileUserAgent', () => {
  it('detects iPhone Safari as mobile', () => {
    expect(
      isMobileUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true);
  });

  it('detects Android Chrome as mobile', () => {
    expect(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe(
      true
    );
  });

  it('detects desktop macOS Chrome as not mobile', () => {
    expect(
      isMobileUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0'
      )
    ).toBe(false);
  });

  it('detects desktop Windows Firefox as not mobile', () => {
    expect(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0')).toBe(
      false
    );
  });

  it('treats a missing user agent as not mobile', () => {
    expect(isMobileUserAgent(null)).toBe(false);
  });
});
