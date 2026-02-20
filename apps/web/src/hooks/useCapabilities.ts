'use client';

import { useState, useEffect } from 'react';

interface Capabilities {
  canRecord: boolean;
  canExport: boolean;
  canTranscribe: boolean;
  warnings: string[];
  isLoading: boolean;
}

export function useCapabilities(): Capabilities {
  const [capabilities, setCapabilities] = useState<Capabilities>({
    canRecord: false,
    canExport: false,
    canTranscribe: false,
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

      // Export: captureStream + MediaRecorder
      let canExport = false;
      try {
        const canvas = document.createElement('canvas');
        const hasCapture = typeof canvas.captureStream === 'function';
        const hasRecorder = typeof window.MediaRecorder !== 'undefined';
        const hasMime =
          hasRecorder &&
          (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
            MediaRecorder.isTypeSupported('video/webm') ||
            MediaRecorder.isTypeSupported('video/mp4'));
        canExport = hasCapture && hasMime;
      } catch {
        canExport = false;
      }

      if (!canExport) {
        warnings.push(
          'Video export is not fully supported in this browser. Try Chrome or Edge for the best experience.'
        );
      }

      // Transcription: SpeechRecognition
      const w = window as unknown as Record<string, unknown>;
      const canTranscribe =
        typeof window !== 'undefined' &&
        (typeof w['SpeechRecognition'] !== 'undefined' ||
          typeof w['webkitSpeechRecognition'] !== 'undefined');

      if (!canTranscribe) {
        warnings.push(
          'Live transcription is not supported in this browser. You can still edit captions manually.'
        );
      }

      setCapabilities({
        canRecord,
        canExport,
        canTranscribe,
        warnings,
        isLoading: false,
      });
    };

    detect();
  }, []);

  return capabilities;
}
