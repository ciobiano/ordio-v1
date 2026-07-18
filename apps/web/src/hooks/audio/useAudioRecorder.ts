'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { saveRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

const RECORDING_DRAFT_SAVE_INTERVAL_MS = 5000;

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
  startRecording: (deviceId?: string) => Promise<MediaStream | undefined>;
  stopRecording: () => void;
  /**
   * Stops recording and resolves with the final Blob once MediaRecorder's
   * async `onstop` fires. `audioBlob` state is NOT yet set on the very next
   * line after `stopRecording()` — callers that need the blob immediately
   * must use this instead of reading `audioBlob`.
   */
  stopAndGetBlob: () => Promise<Blob | null>;
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
  const pendingStopRef = useRef<((blob: Blob) => void) | null>(null);
  const saveDraftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');

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

  const clearSaveDraftTimer = useCallback(() => {
    if (saveDraftTimerRef.current) {
      clearInterval(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    const durationSec = (Date.now() - recordingStartRef.current) / 1000;
    void saveRecordingDraft(blob, { mimeType: mimeTypeRef.current, durationSec });
  }, []);

  const startSaveDraftTimer = useCallback(() => {
    clearSaveDraftTimer();
    saveDraftTimerRef.current = setInterval(persistDraftNow, RECORDING_DRAFT_SAVE_INTERVAL_MS);
  }, [clearSaveDraftTimer, persistDraftNow]);

  const startRecording = useCallback(async (deviceId?: string): Promise<MediaStream | undefined> => {
    try {
      setError(null);
      chunksRef.current = [];

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
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
      mimeTypeRef.current = mimeType;
      recordingStartRef.current = Date.now();

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
        clearSaveDraftTimer();
        const durationSec = (Date.now() - recordingStartRef.current) / 1000;
        void saveRecordingDraft(blob, { mimeType, durationSec });
        pendingStopRef.current?.(blob);
        pendingStopRef.current = null;
      };

      recorder.start(100); // Collect data every 100ms
      setState('recording');
      setRecordingTime(0);
      startTimer();
      startSaveDraftTimer();

      return stream;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      return undefined;
    }
  }, [startTimer, clearTimer, startSaveDraftTimer, clearSaveDraftTimer, options]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    // Stop both raw mic tracks and any enhanced stream tracks
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearTimer();
  }, [clearTimer]);

  const stopAndGetBlob = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      stopRecording();
      return Promise.resolve(null);
    }
    const promise = new Promise<Blob | null>((resolve) => {
      pendingStopRef.current = resolve;
    });
    stopRecording();
    return promise;
  }, [stopRecording]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setState('paused');
      clearTimer();
      persistDraftNow();
      clearSaveDraftTimer();
    }
  }, [clearTimer, persistDraftNow, clearSaveDraftTimer]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setState('recording');
      startTimer();
      startSaveDraftTimer();
    }
  }, [startTimer, startSaveDraftTimer]);

  const resetRecording = useCallback(() => {
    stopRecording();
    clearSaveDraftTimer();
    setState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
    void clearRecordingDraft();
  }, [stopRecording, clearSaveDraftTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rawStreamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      clearTimer();
      clearSaveDraftTimer();
    };
  }, [clearTimer, clearSaveDraftTimer]);

  return {
    state,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    stopAndGetBlob,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
