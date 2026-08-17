'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/audio/useAudioAnalyser';
import { useLiveTranscription } from '@/hooks/recording/useLiveTranscription';
import { useRecordingRecovery } from '@/hooks/recording/useRecordingRecovery';
import { useTranscription } from '@/hooks/recording/useTranscription';
import {
  AudioProcessingError,
  useAudioProcessing,
} from '@/hooks/audio/useAudioProcessing';
import { useEpisodeIngestion, type UseEpisodeIngestionReturn } from '@/hooks/audio/useEpisodeIngestion';
import { useMicDevices, type UseMicDevicesReturn } from '@/hooks/studio/useMicDevices';
import { isEpisodeFile } from '@/lib/episodeRouting';
import { validateFile, validateEpisodeFile, FILE_ERROR_MESSAGES } from '@/lib/fileValidation';
import { useCaptureStore, useProcessingStore } from '@/stores';
import type { Word } from '@Ordio/shared/schemas';

export type StudioView = 'idle' | 'capture' | 'processing' | 'edit' | 'export';

export interface UseStudioFlowReturn {
  view: StudioView;
  sessionId: string | null;
  recordingTime: number;
  processingProgress: number;
  transcript: Word[];
  /** Live during-recording caption text (committed + interim). Disposable UI. */
  liveCaptionText: string;
  isStarting: boolean;
  micDenied: boolean;
  mics: UseMicDevicesReturn;
  /** Long-episode clip-finder pipeline — files routed here bypass processFile. */
  episode: UseEpisodeIngestionReturn;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  processFile: (file: File) => Promise<void>;
  /** Opens the session created by the episode clip-picker (bypasses clearLoadedClip since it's a freshly transcribed clip, not a library switch). */
  openEpisodeClip: (sessionId: string) => void;
  openClip: (sessionId: string) => void;
  goIdle: () => void;
  goExport: () => void;
  getAudioLevel: () => number;
  cancelProcessing: () => void;
  /** Mid-recording pause, matching the mobile capture dock. */
  isPaused: boolean;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

function processingErrorMessage(err: unknown): string {
  if (err instanceof AudioProcessingError) {
    if (err.stage === 'enhancement') {
      return 'Enhancement failed — turn enhancement off in the inspector and retry.';
    }
    if (err.stage === 'transcription') {
      return 'Transcription failed — check your connection and retry.';
    }
  }
  return 'Processing failed — you can retry from here.';
}

export function useStudioFlow(): UseStudioFlowReturn {
  const [view, setView] = useState<StudioView>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const live = useLiveTranscription();
  const mics = useMicDevices();
  const episode = useEpisodeIngestion();

  // Surface live-caption failures once; recording itself is unaffected.
  const lastLiveErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (live.liveError && live.liveError !== lastLiveErrorRef.current) {
      lastLiveErrorRef.current = live.liveError;
      toast.error(live.liveError);
    }
  }, [live.liveError]);
  const { processingProgress, processAudio, cancelProcessing: cancelProcessingJob } =
    useAudioProcessing(transcription);

  const resetCapture = useCaptureStore((s) => s.resetCapture);
  const resetProcessing = useProcessingStore((s) => s.resetProcessing);

  // Loading a different clip (or none) must clear the shared stores, or
  // useSessionHydration sees a stale audioBuffer and silently keeps the
  // previous clip's audio + transcript on screen.
  const clearLoadedClip = useCallback(() => {
    resetCapture();
    resetProcessing();
  }, [resetCapture, resetProcessing]);

  const startRecording = useCallback(async () => {
    setIsStarting(true);
    transcription.clearTranscript();
    clearLoadedClip();
    setSessionId(null);
    try {
      const stream = await recorder.startRecording(mics.selectedDeviceId);
      if (!stream) {
        setMicDenied(true);
        return;
      }
      setMicDenied(false);
      // Permission granted → device labels are now readable.
      void mics.refresh();
      analyser.connectStream(stream);
      live.resetCaptions();
      live.startLive(stream);
      setView('capture');
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription, mics, clearLoadedClip, live]);

  const runProcessing = useCallback(
    async (source: Blob) => {
      setView('processing');
      try {
        const newSessionId = await processAudio(source);
        if (!newSessionId) {
          setView('idle');
          return;
        }
        setSessionId(newSessionId);
        setView('edit');
      } catch (err) {
        toast.error(processingErrorMessage(err));
        setView('idle');
      }
    },
    [processAudio]
  );

  const handleResumeRecovery = useCallback(
    async (blob: Blob) => {
      await runProcessing(blob);
    },
    [runProcessing]
  );

  useRecordingRecovery(handleResumeRecovery);

  // Suspending the live stream is the load-bearing half of a pause, not a
  // nicety: the realtime transcription socket bills for what it receives, so a
  // pause that only stopped the recorder would keep paying to transcribe silence
  // for as long as the user was away. Mirrors useCreateFlow exactly.
  const pauseRecording = useCallback(() => {
    recorder.pauseRecording();
    live.setLiveSuspended(true);
  }, [recorder, live]);

  const resumeRecording = useCallback(() => {
    recorder.resumeRecording();
    live.setLiveSuspended(false);
  }, [recorder, live]);

  const stopRecording = useCallback(async () => {
    live.stopLive();
    analyser.disconnect();
    // MediaRecorder finalizes the blob asynchronously in `onstop` — reading
    // recorder.audioBlob here would always see null.
    const blob = await recorder.stopAndGetBlob();
    if (!blob || blob.size === 0) {
      toast.error('No audio was captured.');
      setView('idle');
      return;
    }
    await runProcessing(blob);
  }, [recorder, analyser, runProcessing, live]);

  const processFile = useCallback(
    async (file: File) => {
      // Long files (or files too large for the direct Whisper path) route to
      // the episode pipeline instead — otherwise processAudio throws
      // 'Audio file is too large to transcribe in production' and the drop
      // just fails.
      if (await isEpisodeFile(file)) {
        const episodeError = validateEpisodeFile(file);
        if (episodeError) {
          toast.error(FILE_ERROR_MESSAGES[episodeError]);
          return;
        }
        toast.info('Long episode detected — finding your best moments…');
        void episode.startEpisode(file);
        return;
      }

      const error = validateFile(file);
      if (error) {
        toast.error(FILE_ERROR_MESSAGES[error]);
        return;
      }

      transcription.clearTranscript();
      clearLoadedClip();
      setSessionId(null);
      await runProcessing(file);
    },
    [transcription, clearLoadedClip, runProcessing, episode]
  );

  const openEpisodeClip = useCallback((clipSessionId: string) => {
    episode.cancel();
    setSessionId(clipSessionId);
    setView('edit');
  }, [episode]);

  const openClip = useCallback(
    (clipSessionId: string) => {
      if (clipSessionId !== sessionId) clearLoadedClip();
      setSessionId(clipSessionId);
      setView('edit');
    },
    [sessionId, clearLoadedClip]
  );

  const goIdle = useCallback(() => {
    live.stopLive();
    live.resetCaptions();
    clearLoadedClip();
    setSessionId(null);
    setView('idle');
  }, [clearLoadedClip, live]);

  const goExport = useCallback(() => setView('export'), []);

  const cancelProcessing = useCallback(() => {
    cancelProcessingJob();
    setSessionId(null);
    setView('idle');
  }, [cancelProcessingJob]);

  return {
    view,
    sessionId,
    recordingTime: recorder.recordingTime,
    processingProgress,
    transcript: transcription.transcript,
    liveCaptionText: [...live.committedLines, live.interimText].join(' ').trim(),
    isStarting,
    micDenied,
    mics,
    episode,
    startRecording,
    stopRecording,
    processFile,
    openEpisodeClip,
    openClip,
    goIdle,
    goExport,
    getAudioLevel: analyser.getAudioLevel,
    cancelProcessing,
    isPaused: recorder.isPaused,
    pauseRecording,
    resumeRecording,
  };
}
