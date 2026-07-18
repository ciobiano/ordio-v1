import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasWebCodecsSupport } from '@Ordio/engine/video/videoEncoder';

vi.mock('@Ordio/engine/loaders', () => ({
  loadFont: vi.fn().mockResolvedValue(undefined),
  loadGraphic: vi.fn().mockResolvedValue(undefined),
}));

describe('lib: videoEncoder', () => {
  describe('hasWebCodecsSupport', () => {
    it('should return boolean', () => {
      const result = hasWebCodecsSupport();
      expect(typeof result).toBe('boolean');
    });

    it('should be consistent across calls', () => {
      const result1 = hasWebCodecsSupport();
      const result2 = hasWebCodecsSupport();
      expect(result1).toBe(result2);
    });
  });
});