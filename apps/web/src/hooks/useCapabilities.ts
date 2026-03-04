'use client';

import { useState, useEffect } from 'react';

interface Capabilities {
  canRecord: boolean;
  canExport: boolean;
  canTranscribe: boolean;
  hasWebCodecs: boolean;
  hasAudioWorklet: boolean;
  hasWebAssembly: boolean;
  canUseRnnoise: boolean;
  warnings: string[];
  isLoading: boolean;
}

export function useCapabilities(): Capabilities {
  const [capabilities, setCapabilities] = useState<Capabilities>({
    canRecord: false,
    canExport: false,
    canTranscribe: false,
    hasWebCodecs: false,
    hasAudioWorklet: false,
    hasWebAssembly: false,
    canUseRnnoise: false,
    warnings: [],
    isLoading: true,
  });

  useEffect(() => {
    const detect = async () => {
      const warnings: string[] = [];

      // Recording: getUserMedia
      const canRecord =
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function';

      if (!canRecord) {
        warnings.push('Microphone recording is not supported in this browser.');
      }

      // Export: WebCodecs (primary) or MediaRecorder (fallback)
      let canExport = false;
      try {
        const hasWebCodecsExport =
          typeof (window as unknown as Record<string, unknown>)['VideoEncoder'] !== 'undefined';
        const hasRecorder = typeof window.MediaRecorder !== 'undefined';
        const hasMime =
          hasRecorder &&
          (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
            MediaRecorder.isTypeSupported('video/webm') ||
            MediaRecorder.isTypeSupported('video/mp4'));
        canExport = hasWebCodecsExport || hasMime;
      } catch {
        canExport = false;
      }

      if (!canExport) {
        warnings.push(
          'Video export is not fully supported in this browser. Try Chrome or Edge for the best experience.'
        );
      }

      // WebCodecs: VideoEncoder + AudioEncoder (required for Mediabunny MP4 export)
      const hasWebCodecs =
        typeof window !== 'undefined' &&
        typeof (window as unknown as Record<string, unknown>)['VideoEncoder'] !== 'undefined' &&
        typeof (window as unknown as Record<string, unknown>)['AudioEncoder'] !== 'undefined';

      if (!hasWebCodecs) {
        warnings.push(
          'Using compatibility mode — export will be slower on this browser.'
        );
      }

      // Transcription is handled server-side via Whisper API
      const canTranscribe = true;

      // AudioWorklet + WebAssembly (required for RNNoise)
      const hasAudioWorklet =
        typeof window !== 'undefined' &&
        typeof window.AudioContext !== 'undefined' &&
        typeof AudioWorkletNode !== 'undefined';

      const hasWebAssembly =
        typeof WebAssembly !== 'undefined' &&
        typeof WebAssembly.instantiate === 'function';

      const canUseRnnoise = hasAudioWorklet && hasWebAssembly;

      setCapabilities({
        canRecord,
        canExport,
        canTranscribe,
        hasWebCodecs,
        hasAudioWorklet,
        hasWebAssembly,
        canUseRnnoise,
        warnings,
        isLoading: false,
      });
    };

    detect();
  }, []);

  return capabilities;
}
