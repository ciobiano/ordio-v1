'use client';

import { useRef, useCallback, useEffect } from 'react';

interface UseAudioAnalyserReturn {
  analyserRef: React.RefObject<AnalyserNode | null>;
  connectBuffer: (buffer: AudioBuffer, ctx: AudioContext) => AudioBufferSourceNode;
  getFrequencyData: () => Uint8Array;
  getAudioLevel: () => number;
  disconnect: () => void;
}

export function useAudioAnalyser(): UseAudioAnalyserReturn {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const connectBuffer = useCallback(
    (buffer: AudioBuffer, ctx: AudioContext): AudioBufferSourceNode => {
      // Disconnect any existing source
      sourceRef.current?.disconnect();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;

      return source;
    },
    []
  );

  const getFrequencyData = useCallback((): Uint8Array => {
    if (!analyserRef.current) return new Uint8Array(0);
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  const getAudioLevel = useCallback((): number => {
    const data = getFrequencyData();
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + val, 0);
    return sum / (data.length * 255); // Normalize to 0-1
  }, [getFrequencyData]);

  const disconnect = useCallback(() => {
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { analyserRef, connectBuffer, getFrequencyData, getAudioLevel, disconnect };
}
