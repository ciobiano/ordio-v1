import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Audio } from 'remotion';
import { JobConfig } from '@Ordio/shared/schemas';
import { waveformSampler } from '@Ordio/shared/waveform';

export const Audiogram: React.FC<JobConfig> = ({ timeline, style }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Mock audio data generation for now since we can't load external files in dev preview easily without a proxy
  // In production, this would come from `audioStorageId`
  const audioData = useMemo(() => {
    // Generate a fake sine wave buffer for visualization testing
    const sampleRate = 44100;
    const length = sampleRate * 10; // 10s
    const channel = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        channel[i] = Math.sin(i * 0.01) * 0.5;
    }
    
    return {
        length,
        sampleRate,
        numberOfChannels: 1,
        getChannelData: () => channel
    };
  }, []);

  const waveform = useMemo(() => {
    // 1 bar every 4 pixels
    const barCount = Math.floor(width / 4);
    return waveformSampler(audioData, barCount);
  }, [width, audioData]);

  // Render Waveform
  return (
    <AbsoluteFill style={{ backgroundColor: style.backgroundColor }}>
      <div 
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            gap: '2px'
        }}
      >
        {waveform.map((amp, i) => {
            return (
                <div
                    key={i}
                    style={{
                        width: 3,
                        height: amp * 400, // Scale factor
                        backgroundColor: style.waveColor,
                        borderRadius: 2
                    }}
                />
            );
        })}
      </div>
      
      {/* TODO: Add Audio tag when we have a real URL */}
      {/* <Audio src={audioUrl} /> */}
    </AbsoluteFill>
  );
};
