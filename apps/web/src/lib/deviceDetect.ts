const MOBILE_USER_AGENT_RE = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry/i;

/**
 * Heuristic only — iPadOS 13+ reports a desktop Safari UA by default, so a
 * user could still land on /studio from an iPad. Good enough for a
 * navigation nudge, not a security boundary.
 */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_USER_AGENT_RE.test(userAgent);
}
