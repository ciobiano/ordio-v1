import { describe, it, expect } from 'vitest';
import { timeToFrame, frameToTime, formatTime, FPS } from '../src/time';

describe('Time Utilities', () => {
  it('should convert time to frame correctly', () => {
    // 1s at 30fps = 30 frames
    expect(timeToFrame(1)).toBe(30);
    // 0.5s at 30fps = 15 frames
    expect(timeToFrame(0.5)).toBe(15);
  });

  it('should handle non-integer frame results with rounding', () => {
    // 0.0333...s is roughly 1 frame
    expect(timeToFrame(0.0334)).toBe(1);
  });

  it('should convert frame to time correctly', () => {
    expect(frameToTime(30)).toBe(1);
    expect(frameToTime(15)).toBe(0.5);
  });

  it('should be reversible within margin of error', () => {
    const originalTime = 12.34;
    const frame = timeToFrame(originalTime);
    const resultTime = frameToTime(frame);
    expect(Math.abs(originalTime - resultTime)).toBeLessThan(1 / FPS);
  });

  describe('formatTime', () => {
    it('should format seconds to MM:SS', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(3600)).toBe('60:00'); // Simple implementation
    });
  });
});
