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
import { useCapabilities } from '@/hooks/recording/useCapabilities';
import { useVAD } from '@/hooks/recording/useVAD';
import { useEpisodeIngestion } from '@/hooks/audio/useEpisodeIngestion';
import {
  validateFile,
  validateEpisodeFile,
  MAX_FILE_SIZE_BYTES,
  FILE_ERROR_MESSAGES,
} from '@/lib/fileValidation';
import { EPISODE_ROUTE_THRESHOLD_SEC } from '@/lib/media/episodePlan';

/** Fast duration probe via metadata only (no decode). Returns null on any failure. */
async function probeDurationSec(file: File): Promise<number | null> {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      return await input.computeDuration();
    } finally {
      input.dispose();
    }
  } catch {
    return null;
  }
}

/**
 * Conservative lower bound on audio bitrate (bits/sec). Real-world audio is
 * essentially never encoded below this — used only to compute a byte-size
 * floor below which a file physically cannot contain
 * EPISODE_ROUTE_THRESHOLD_SEC seconds of audio.
 */
export const MIN_PLAUSIBLE_AUDIO_BITRATE_BPS = 32_000;

/**
 * Byte-size floor below which a file cannot possibly hold more than
 * EPISODE_ROUTE_THRESHOLD_SEC seconds of audio, even at the lowest plausible
 * bitrate. Files under this size skip the async duration probe entirely and
 * go straight to the existing (synchronous) short-path validation — this is
 * a heuristic, not a hard guarantee: a real long file with an unusually low
 * bitrate could fall under this floor and be misrouted to the short path,
 * but that just means it hits validateFile's normal checks like any file
 * does today, so it is not a regression.
 *
 * Math: EPISODE_ROUTE_THRESHOLD_SEC (900s) * 32_000 bps / 8 bits-per-byte
 * = 3,600,000 bytes (~3.43 MiB).
 */
const PROBE_SKIP_SIZE_BYTES =
  (EPISODE_ROUTE_THRESHOLD_SEC * MIN_PLAUSIBLE_AUDIO_BITRATE_BPS) / 8;

// ── Processing alert types ───────────────────────────────────────────

export interface ProcessingAlertState {
  stage: AudioProcessingFailureStage;
  title: string;
  detail: string;
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

export function useCreateFlow() {
  const router = useRouter();
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
  const [processingAlert, setProcessingAlert] = useState<ProcessingAlertState | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio, cancelProcessing } = useAudioProcessing(transcription);
  const capabilities = useCapabilities();
  const vad = useVAD(recorder.isRecording);
  const episode = useEpisodeIngestion();

  // ── Error handling ───────────────────────────────────────────────

  const handleProcessingFailure = useCallback((err: unknown) => {
    if (err instanceof AudioProcessingError) {
      setProcessingAlert(buildProcessingAlert(err));
      return;
    }
    setProcessingAlert({
      stage: 'processing',
      title: 'Processing failed',
      detail: 'Processing stopped safely. You can retry from your previous screen.',
    });
  }, []);

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
    transcription.clearTranscript();
    try {
      const stream = await recorder.startRecording();
      if (!stream) {
        const isDenied =
          recorder.error?.toLowerCase().includes('denied') ||
          recorder.error?.toLowerCase().includes('permission');
        if (isDenied) setMicDenied(true);
        return;
      }
      setMicDenied(false);
      analyser.connectStream(stream);
      setCurrentState('recording');
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription, setCurrentState]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    analyser.disconnect();
  }, [recorder, analyser]);

  const handleProceed = useCallback(async () => {
    if (!recorder.audioBlob) return;
    setProcessingAlert(null);
    try {
      const sessionId = await processAudio(recorder.audioBlob);
      if (!sessionId) return;
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [recorder.audioBlob, processAudio, router, handleProcessingFailure]);

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
    // episode pipeline instead of the staged-file confirm flow. The
    // duration probe is metadata-only and fails closed: any error (corrupt
    // file, unsupported container, etc.) falls through to the existing
    // short-path validation below, unchanged.
    //
    // Perf: skip the async probe entirely for files too small to possibly
    // be long episodes (see PROBE_SKIP_SIZE_BYTES) — keeps the overwhelming
    // majority of short-file uploads fully synchronous, as before.
    const tooBigForShortPath = file.size > MAX_FILE_SIZE_BYTES;
    const couldBeLongEpisode = file.size >= PROBE_SKIP_SIZE_BYTES;
    const durationSec = couldBeLongEpisode ? await probeDurationSec(file) : null;
    const isEpisode =
      (durationSec !== null && durationSec > EPISODE_ROUTE_THRESHOLD_SEC) ||
      tooBigForShortPath; // too big for the short path — try episode path

    if (isEpisode) {
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
      router.push(`/create/export/${sessionId}`);
    } catch (err) {
      handleProcessingFailure(err);
    }
  }, [stagedFile, processAudio, router, handleProcessingFailure]);

  // ── Reset / settings ─────────────────────────────────────────────

  const handleReset = useCallback(() => {
    cancelProcessing();
    recorder.resetRecording();
    transcription.clearTranscript();
    setProcessingAlert(null);
    reset();
  }, [cancelProcessing, recorder, transcription, reset]);

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
    processingAlert,
    processingProgress,
    stagedFile,
    fileInputRef,

    // Capabilities
    capabilities,

    // Recording
    recorder,
    handleStartRecording,
    handleStopRecording,
    handleProceed,
    handleRestart,
    setUpgradeTarget,

    // File upload
    handleFileSelect,
    handleFileConfirm,
    setStagedFile,

    // Long-episode clip-finder pipeline
    episode,

    // Processing
    handleReset,
    handleDisableEnhancement,
    dismissAlert,
  };
}
