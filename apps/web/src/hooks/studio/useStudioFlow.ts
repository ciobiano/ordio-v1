'use client';

import { useCallback, useState } from 'react';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/audio/useAudioAnalyser';
import { useTranscription } from '@/hooks/recording/useTranscription';
import { useAudioProcessing } from '@/hooks/audio/useAudioProcessing';
import type { Word } from '@Ordio/shared/schemas';

export type StudioView = 'idle' | 'capture' | 'processing' | 'edit' | 'export';

export interface UseStudioFlowReturn {
  view: StudioView;
  sessionId: string | null;
  recordingTime: number;
  processingProgress: number;
  transcript: Word[];
  isStarting: boolean;
  micDenied: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  openClip: (sessionId: string) => void;
  goIdle: () => void;
  goExport: () => void;
  getAudioLevel: () => number;
}

export function useStudioFlow(): UseStudioFlowReturn {
  const [view, setView] = useState<StudioView>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);

  const startRecording = useCallback(async () => {
    setIsStarting(true);
    transcription.clearTranscript();
    try {
      const stream = await recorder.startRecording();
      if (!stream) {
        setMicDenied(true);
        return;
      }
      setMicDenied(false);
      analyser.connectStream(stream);
      setView('capture');
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription]);

  const stopRecording = useCallback(async () => {
    recorder.stopRecording();
    analyser.disconnect();
    setView('processing');
    if (!recorder.audioBlob) return;
    const newSessionId = await processAudio(recorder.audioBlob);
    if (!newSessionId) {
      setView('idle');
      return;
    }
    setSessionId(newSessionId);
    setView('edit');
  }, [recorder, analyser, processAudio]);

  const openClip = useCallback((clipSessionId: string) => {
    setSessionId(clipSessionId);
    setView('edit');
  }, []);

  const goIdle = useCallback(() => {
    setSessionId(null);
    setView('idle');
  }, []);

  const goExport = useCallback(() => setView('export'), []);

  return {
    view,
    sessionId,
    recordingTime: recorder.recordingTime,
    processingProgress,
    transcript: transcription.transcript,
    isStarting,
    micDenied,
    startRecording,
    stopRecording,
    openClip,
    goIdle,
    goExport,
    getAudioLevel: analyser.getAudioLevel,
  };
}
