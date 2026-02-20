/**
 * Samples audio data to create a visualization-ready waveform.
 * Designed to work with both Web Audio API AudioBuffers and raw data.
 */

// Interface compatible with AudioBuffer
export interface AudioData {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Downsamples audio data to a fixed number of bars.
 * Uses root-mean-square (RMS) for accurate loudness representation.
 * @param buffer The audio buffer source
 * @param samples Number of bars to generate
 */
export function waveformSampler(buffer: AudioData, samples: number): number[] {
  const channelData = buffer.getChannelData(0); // Use first channel (mono)
  const blockSize = Math.floor(channelData.length / samples); 
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let sum = 0;
    
    // Calculate RMS for this block
    for (let j = 0; j < blockSize; j++) {
      if (start + j < channelData.length) {
        const amplitude = channelData[start + j];
        sum += amplitude * amplitude;
      }
    }
    
    const rms = Math.sqrt(sum / blockSize);
    waveform.push(rms);
  }

  // Normalize to 0-1 range
  const max = Math.max(...waveform);
  if (max > 0) {
    return waveform.map((val) => val / max);
  }
  
  return waveform;
}
