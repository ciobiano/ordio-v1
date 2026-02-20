/**
 * Core time utilities for ensuring frame-perfect synchronization
 * between client preview and server rendering.
 */

export const FPS = 30;

/**
 * Converts a time in seconds to a frame number.
 * Uses Math.round to ensure consistency.
 */
export function timeToFrame(time: number, fps: number = FPS): number {
  return Math.round(time * fps);
}

/**
 * Converts a frame number to time in seconds.
 */
export function frameToTime(frame: number, fps: number = FPS): number {
  return frame / fps;
}

/**
 * Formats seconds into MM:SS format.
 * @example 75 -> "01:15"
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
