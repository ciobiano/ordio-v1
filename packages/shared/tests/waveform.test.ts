import { describe, it, expect } from 'vitest';
import { waveformSampler } from '../src/waveform';

describe('Waveform Sampler', () => {
  it('should return requested number of samples', () => {
    const mockData = new Float32Array(100).fill(0.5);
    const mockBuffer = {
      length: 100,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => mockData
    };
    
    const samples = waveformSampler(mockBuffer, 10);
    expect(samples.length).toBe(10);
  });

  it('should normalize output between 0 and 1', () => {
    // Create data with varying amplitudes
    const mockData = new Float32Array(100);
    for(let i=0; i<100; i++) mockData[i] = (i % 2 === 0) ? 1.0 : -0.5;
    
    const mockBuffer = {
      length: 100,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => mockData
    };

    const samples = waveformSampler(mockBuffer, 5);
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
  });
});
