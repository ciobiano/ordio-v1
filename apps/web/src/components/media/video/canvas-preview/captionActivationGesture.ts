export type CaptionActivationTap = {
  timestamp: number;
  clientX: number;
  clientY: number;
};

const DOUBLE_TAP_MAX_INTERVAL_MS = 320;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;

/**
 * How long a single tap waits before committing to its action (play/pause
 * fallthrough) — must match the double-tap interval so a second tap inside
 * the window upgrades the gesture instead of firing both actions.
 */
export const CAPTION_ACTIVATION_DOUBLE_TAP_WINDOW_MS = DOUBLE_TAP_MAX_INTERVAL_MS;

export function isCaptionActivationDoubleTap(
  previousTap: CaptionActivationTap | null,
  nextTap: CaptionActivationTap
): boolean {
  if (!previousTap) {
    return false;
  }

  const elapsedMs = nextTap.timestamp - previousTap.timestamp;
  const movedX = nextTap.clientX - previousTap.clientX;
  const movedY = nextTap.clientY - previousTap.clientY;
  const movedDistance = Math.hypot(movedX, movedY);

  return elapsedMs <= DOUBLE_TAP_MAX_INTERVAL_MS && movedDistance <= DOUBLE_TAP_MAX_DISTANCE_PX;
}
