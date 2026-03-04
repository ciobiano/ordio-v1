'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseAudioRecorderOptions {
  streamTransformer?: (raw: MediaStream) => Promise<MediaStream>;
}

interface UseAudioRecorderReturn {
  state: RecorderState;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<MediaStream | undefined>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(
  options?: UseAudioRecorderOptions
): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
  }, [clearTimer]);

  const startRecording = useCallback(async (): Promise<MediaStream | undefined> => {
    try {
      setError(null);
      chunksRef.current = [];

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: { ideal: true },
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
        },
      });
      rawStreamRef.current = rawStream;

      // Apply enhancement pipeline if provided
      const stream = options?.streamTransformer
        ? await options.streamTransformer(rawStream)
        : rawStream;
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      const mimeType = recorder.mimeType || 'audio/webm';
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setState('stopped');
        clearTimer();
      };

      recorder.start(100); // Collect data every 100ms
      setState('recording');
      setRecordingTime(0);
      startTimer();

      return stream;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      return undefined;
    }
  }, [startTimer, clearTimer]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    // Stop both raw mic tracks and any enhanced stream tracks
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearTimer();
  }, [clearTimer]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setState('paused');
      clearTimer();
    }
  }, [clearTimer]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setState('recording');
      startTimer();
    }
  }, [startTimer]);

  const resetRecording = useCallback(() => {
    stopRecording();
    setState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rawStreamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
