// hooks/recording/useCreateFlow.ts
// Orchestrates the create page: recording, file upload, and processing.
// Extracted from page.tsx to keep the page component as pure layout.
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUIStore, useCaptureStore, useProcessingStore } from '@/stores';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/audio/useAudioAnalyser';
import { useTranscription } from '@/hooks/recording/useTranscription';
import {
  AudioProcessingError,
  type AudioProcessingFailureStage,
  useAudioProcessing,
} from '@/hooks/audio/useAudioProcessing';
import { InsufficientCreditsError } from '@/lib/transcription/insufficientCredits';
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useLiveTranscription } from '@/hooks/recording/useLiveTranscription';
import { useMicPermission } from '@/hooks/recording/useMicPermission';
import { useRecordingRecovery } from '@/hooks/recording/useRecordingRecovery';
import { useVAD } from '@/hooks/recording/useVAD';
import { useEpisodeIngestion } from '@/hooks/audio/useEpisodeIngestion';
import {
  validateFile,
  validateEpisodeFile,
  FILE_ERROR_MESSAGES,
} from '@/lib/fileValidation';
import { isEpisodeFile } from '@/lib/episodeRouting';

// ── Processing alert types ───────────────────────────────────────────

export interface ProcessingAlertState {
  stage: AudioProcessingFailureStage;
  title: string;
  detail: string;
}

/**
 * Pull the out-of-credits failure back out of the wrapper.
 *
 * `useAudioProcessing` wraps every transcription failure in an
 * `AudioProcessingError`, preserving the original as `cause`. Running out of
 * credits arrives that way too, but it is not a failure in the usual sense —
 * nothing broke, and retrying cannot succeed — so it needs telling apart before
 * the generic "Transcription failed" copy is chosen.
 */
function outOfCreditsFrom(error: AudioProcessingError): InsufficientCreditsError | null {
  return error.cause instanceof InsufficientCreditsError ? error.cause : null;
}

function buildProcessingAlert(error: AudioProcessingError): ProcessingAlertState {
  if (error.stage === 'enhancement') {
    return {
      stage: error.stage,
      title: 'Enhancement failed',
      detail:
        'Processing stopped before transcription. For faster recovery and lower additional AI usage, turn enhancement off and retry.',
    };
  }

  if (error.stage === 'transcription') {
    return {
      stage: error.stage,
      title: 'Transcription failed',
      detail:
        'Processing stopped and you were returned to your previous screen. Review your recording or upload and retry when ready.',
    };
  }

  return {
    stage: error.stage,
    title: 'Processing failed',
    detail: 'Processing stopped safely. You can adjust settings and retry from this screen.',
  };
}

// ── Hook ─────────────────────────────────────────────────────────────

export interface CreateFlowOptions {
  /**
   * What to do once processing has produced a session.
   *
   * Mobile has nowhere to put an editor, so it navigates to
   * `/create/export/[sessionId]` — the default when this is omitted. The
   * desktop shell already *is* the editor: the clip it just recorded should
   * appear in the stage it is looking at, not one route away. Passing a
   * handler here replaces the navigation rather than running alongside it,
   * so exactly one of the two happens.
   */
  onSessionReady?: (sessionId: string) => void;
}

export function useCreateFlow(options: CreateFlowOptions = {}) {
  const router = useRouter();
  const { onSessionReady } = options;

  /* Held in a ref so the three call sites below keep stable identities even
     when the caller passes a fresh closure on every render. */
  const onSessionReadyRef = useRef(onSessionReady);
  onSessionReadyRef.current = onSessionReady;

  const deliverSession = useCallback(
    (sessionId: string) => {
      const handle = onSessionReadyRef.current;
      if (handle) handle(sessionId);
      else router.push(`/create/export/${sessionId}`);
    },
    [router]
  );
  const { currentState, setCurrentState, setUpgradeTarget } = useUIStore();
  const resetUI = useUIStore((s) => s.resetUI);
  const resetCapture = useCaptureStore((s) => s.resetCapture);
  const resetProcessing = useProcessingStore((s) => s.resetProcessing);
  const setEnhanceTier = useProcessingStore((s) => s.setEnhanceTier);

  const reset = useCallback(() => {
    resetCapture();
    resetProcessing();
    resetUI();
  }, [resetCapture, resetProcessing, resetUI]);

  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  /**
   * Why the last start attempt failed, when it was not a permission refusal.
   *
   * `startRecording` resolves to `undefined` for every failure — no device, a
   * device held by another app, an insecure origin, a constraint nothing can
   * satisfy — and only a denial was being reported. Everything else returned
   * silently, so a microphone that could not open looked exactly like a button
   * that was not wired to anything. Which is what it was reported as.
   */
  const [startError, setStartError] = useState<string | null>(null);
  const [processingAlert, setProcessingAlert] = useState<ProcessingAlertState | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio, cancelProcessing } = useAudioProcessing(transcription);
  const capabilities = useCapabilities();
  const micPermission = useMicPermission();
  const live = useLiveTranscription();
  const vad = useVAD(recorder.isRecording, micStream);
  const episode = useEpisodeIngestion();

  // Surface live-caption failures once; recording itself is unaffected.
  const lastLiveErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (live.liveError && live.liveError !== lastLiveErrorRef.current) {
      lastLiveErrorRef.current = live.liveError;
      toast.error(live.liveError);
    }
  }, [live.liveError]);

  // ── Error handling ───────────────────────────────────────────────

  const handleProcessingFailure = useCallback((err: unknown) => {
    if (err instanceof AudioProcessingError) {
      // Running out of credits is a limit, not a fault: it goes to the upgrade
      // sheet, which offers a way forward, rather than to the alert banner,
      // which is hard-coded destructive and whose only action here would be
      // "Dismiss".
      if (outOfCreditsFrom(err)) {
        setUpgradeTarget('transcription_credits');
        return;
      }
      setProcessingAlert(buildProcessingAlert(err));
      return;
    }
    setProcessingAlert({
      stage: 'processing',
      title: 'Processing failed',
      detail: 'Processing stopped safely. You can retry from your previous screen.',
    });
  }, [setUpgradeTarget]);

  // ── Audio level sync ─────────────────────────────────────────────

  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      setIsSpeaking(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    setIsSpeaking(vad.isSpeaking);
  }, [recorder.isRecording, vad.isSpeaking]);

  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const tick = () => {
      setAudioLevel(analyser.getAudioLevel());
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [recorder.isRecording, analyser]);

  // ── Recording handlers ───────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    setIsStarting(true);
    setProcessingAlert(null);
    setStartError(null);
    transcription.clearTranscript();
    try {
      const stream = await recorder.startRecording();
      if (!stream) {
        const isDenied =
          recorder.error?.toLowerCase().includes('denied') ||
          recorder.error?.toLowerCase().includes('permission');
        if (isDenied) {
          setMicDenied(true);
          micPermission.recordDenial();
        } else {
          setStartError(
            recorder.error ?? 'Ordio could not open your microphone. Check that no other app is using it.'
          );
        }
        return;
      }
      setMicDenied(false);
      setStartError(null);
      micPermission.recordGrant();
      analyser.connectStream(stream);
      setMicStream(stream);
      live.resetCaptions();
      live.startLive(stream);
      setCurrentState('recording');
    } catch (err) {
      /* Callers fire this without awaiting, so an unhandled rejection here
         disappears entirely and the UI simply never changes. */
      console.error('[useCreateFlow] startRecording', err);
      setStartError(
        err instanceof Error ? err.message : 'Recording could not start. Try again.'
      );
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription, setCurrentState, micPermission, live]);

  const handleStopRecording = useCallback(() => {
    live.stopLive();
    recorder.stopRecording();
    analyser.disconnect();
    setMicStream(null);
  }, [recorder, analyser, live]);

  // Pause/resume must reach both the recorder and the caption stream —
  // paused speech isn't recorded, so captioning it would lie.
  const handlePauseRecording = useCallback(() => {
    recorder.pauseRecording();
    live.setLiveSuspended(true);
  }, [recorder, live]);

  const handleResumeRecording = useCallback(() => {
    recorder.resumeRecording();
    live.setLiveSuspended(false);
  }, [recorder, live]);

  const handleProceed = useCallback(async () => {
    if (!recorder.audioBlob) return;
    setProcessingAlert(null);
    try {
      const sessionId = await processAudio(recorder.audioBlob);
      if (!sessionId) return;
      deliverSession(sessionId);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [recorder.audioBlob, processAudio, deliverSession, handleProcessingFailure]);

  const handleResumeRecovery = useCallback(async (blob: Blob) => {
    setProcessingAlert(null);
    try {
      const sessionId = await processAudio(blob);
      if (!sessionId) return;
      deliverSession(sessionId);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [processAudio, deliverSession, handleProcessingFailure]);

  useRecordingRecovery(handleResumeRecovery);

  const handleRestart = useCallback(async () => {
    setProcessingAlert(null);
    recorder.resetRecording();
    try {
      await handleStartRecording();
    } catch {
      setCurrentState('idle');
    }
  }, [recorder, handleStartRecording, setCurrentState]);

  // ── File upload handlers ─────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    // Long files (or files too large for the short path) route to the
    // episode pipeline instead of the staged-file confirm flow.
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

    setStagedFile(file);
  }, [episode]);

  const handleFileConfirm = useCallback(async () => {
    if (!stagedFile) return;
    const file = stagedFile;
    setStagedFile(null);
    setProcessingAlert(null);

    try {
      const sessionId = await processAudio(file);
      if (!sessionId) return;
      deliverSession(sessionId);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [stagedFile, processAudio, deliverSession, handleProcessingFailure]);

  // ── Reset / settings ─────────────────────────────────────────────

  const handleReset = useCallback(() => {
    cancelProcessing();
    live.stopLive();
    live.resetCaptions();
    recorder.resetRecording();
    setMicStream(null);
    transcription.clearTranscript();
    setProcessingAlert(null);
    reset();
  }, [cancelProcessing, recorder, transcription, reset, live]);

  const handleDisableEnhancement = useCallback(() => {
    setEnhanceTier('none');
    setProcessingAlert(null);
  }, [setEnhanceTier]);

  const dismissAlert = useCallback(() => setProcessingAlert(null), []);

  // ── Public surface ───────────────────────────────────────────────

  return {
    // State
    currentState,
    audioLevel,
    isSpeaking,
    isStarting,
    micDenied,
    startError,
    dismissStartError: () => setStartError(null),
    processingAlert,
    processingProgress,
    stagedFile,
    fileInputRef,

    // Capabilities
    capabilities,
    micPermissionStatus: micPermission.status,

    // Live captions (disposable; final transcript comes from processing)
    committedCaptionLines: live.committedLines,
    interimCaptionText: live.interimText,

    // Recording
    recorder,
    handleStartRecording,
    handleStopRecording,
    handlePauseRecording,
    handleResumeRecording,
    handleProceed,
    handleRestart,
    setUpgradeTarget,

    // File upload
    handleFileSelect,
    handleFileConfirm,
    setStagedFile,

    // Long-episode clip-finder pipeline
    episode,

    /** Where a finished session goes — navigation, or the caller's handler. */
    deliverSession,

    // Processing
    handleReset,
    handleDisableEnhancement,
    dismissAlert,
  };
}
