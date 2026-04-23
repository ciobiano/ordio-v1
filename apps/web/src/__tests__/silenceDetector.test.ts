import { describe, it, expect } from 'vitest';
import { detectSilentRegions, type SilentRegion } from '@/lib/media/silenceDetector';

function createMockAudioBuffer(duration: number, sampleRate = 44100): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const buffer = new AudioBuffer({ length, numberOfChannels: 1, sampleRate });
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = 0;
  }
  return buffer;
}

function createBufferWithSineWave(frequency: number, duration: number, sampleRate = 44100): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const buffer = new AudioBuffer({ length, numberOfChannels: 1, sampleRate });
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
  }
  return buffer;
}

describe('lib: silenceDetector', () => {
  describe('detectSilentRegions', () => {
    it('should return regions for silent buffer with default threshold', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer);
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should return empty array for buffer shorter than minSilenceDuration', () => {
      const buffer = createMockAudioBuffer(0.1);
      const regions = detectSilentRegions(buffer, { minSilenceDuration: 0.3 });
      expect(regions).toEqual([]);
    });

    it('should detect regions in loud buffer (sine wave) with high threshold', () => {
      const buffer = createBufferWithSineWave(440, 1);
      const regions = detectSilentRegions(buffer, { rmsThreshold: 0.8 });
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should detect silent region in quiet buffer with low threshold', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer, { rmsThreshold: 0.001, minSilenceDuration: 0.1 });
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0]).toHaveProperty('start');
      expect(regions[0]).toHaveProperty('end');
      expect(regions[0]).toHaveProperty('duration');
      expect(regions[0]).toHaveProperty('id');
    });

    it('should use custom threshold when provided', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer, { rmsThreshold: 0.1, minSilenceDuration: 0.1 });
      expect(Array.isArray(regions)).toBe(true);
    });

    it('should use custom windowSize', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer, { windowSize: 1024 });
      expect(Array.isArray(regions)).toBe(true);
    });

    it('should return regions with correct id format', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer, { rmsThreshold: 0.001, minSilenceDuration: 0.1 });
      if (regions.length > 0) {
        expect(regions[0].id).toMatch(/^silence-\d+$/);
      }
    });

    it('should set start < end for each region', () => {
      const buffer = createMockAudioBuffer(1);
      const regions = detectSilentRegions(buffer, { rmsThreshold: 0.001, minSilenceDuration: 0.1 });
      for (const region of regions) {
        expect(region.start).toBeLessThan(region.end);
        expect(region.duration).toBeCloseTo(region.end - region.start, 5);
      }
    });
  });
});
