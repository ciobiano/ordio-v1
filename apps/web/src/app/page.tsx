'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useTranscription } from '@/hooks/useTranscription';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';
import { useVideoExporter, fileExtension } from '@/hooks/useVideoExporter';
import { useCapabilities } from '@/hooks/useCapabilities';
import { usePlayback } from '@/hooks/usePlayback';
import { cn } from '@/lib/cn';

import { CapabilityBanner } from '@/components/primitives';
import {
  CaptionStyleSelector,
  WaveformStyleSelector,
  IdleState,
  RecordingState,
  ProcessingState,
  ExportState,
} from '@/components/soul';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function Home() {
  const {
    currentState,
    waveformStyle,
    captionStyle,
    format,
    showControls,
    liveWords,
    setCurrentState,
    setLiveWords,
    setShowControls,
    reset,
  } = useStore();

  const [audioLevel, setAudioLevel] = useState(0);

  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);
  const exporter = useVideoExporter();
  const capabilities = useCapabilities();
  const playback = usePlayback();

  // Audio level animation during recording
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

  // Sync live transcription words to store
  useEffect(() => {
    setLiveWords(transcription.liveWords);
  }, [transcription.liveWords, setLiveWords]);

  // Load audio into playback when entering export phase
  useEffect(() => {
    if (currentState !== 'export') return;
    const { audioBuffer } = useStore.getState();
    if (audioBuffer) playback.load(audioBuffer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState]);

  // Process recorded audio when recording stops
  useEffect(() => {
    if (recorder.state !== 'stopped' || !recorder.audioBlob) return;
    processAudio(recorder.audioBlob, true).catch(() => {});
  }, [recorder.state, recorder.audioBlob, processAudio]);

  const handleStartRecording = useCallback(async () => {
    transcription.clearTranscript();
    await recorder.startRecording();
    setCurrentState('recording');
  }, [recorder, transcription, setCurrentState]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    transcription.stopLiveTranscription();
  }, [recorder, transcription]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert('File too large. Maximum 50MB.');
        return;
      }

      try {
        await processAudio(file);
      } catch {
        alert('Failed to load audio file. Please try MP3, WAV, or M4A.');
      }

      if (e.target) e.target.value = '';
    },
    [processAudio]
  );

  const handleExport = useCallback(async () => {
    const { audioBuffer } = useStore.getState();
    if (!audioBuffer) return;

    const canvas = document.createElement('canvas');
    const dims =
      format === 'square'
        ? [1080, 1080]
        : format === 'vertical'
          ? [1080, 1920]
          : [1920, 1080];
    canvas.width = dims[0];
    canvas.height = dims[1];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await exporter.startExport(canvas, audioBuffer);
  }, [format, exporter]);

  const handleDownload = useCallback(() => {
    if (!exporter.exportedUrl) return;
    const ext = fileExtension(exporter.exportMimeType ?? 'video/webm');
    const a = document.createElement('a');
    a.href = exporter.exportedUrl;
    a.download = `ordio-${Date.now()}.${ext}`;
    a.click();
  }, [exporter.exportedUrl, exporter.exportMimeType]);

  const handleReset = useCallback(() => {
    recorder.resetRecording();
    transcription.clearTranscript();
    exporter.cancelExport();
    playback.stop();
    reset();
  }, [recorder, transcription, exporter, playback, reset]);

  return (
    <div
      className="min-h-screen bg-black text-[#f8fafc] font-[family-name:var(--font-jakarta)]"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {!capabilities.isLoading && <CapabilityBanner warnings={capabilities.warnings} />}

      <div
        className={cn(
          'fixed top-4 right-4 z-40 transition-opacity duration-200',
          showControls && (currentState === 'recording' || currentState === 'export')
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        )}
      >
        <CaptionStyleSelector />
      </div>

      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative"
        role="main"
      >
        {currentState === 'idle' && (
          <IdleState
            onStartRecording={handleStartRecording}
            onFileUpload={handleFileUpload}
            canRecord={capabilities.canRecord}
            isLoading={capabilities.isLoading}
            showControls={showControls}
            waveformStyle={waveformStyle}
            fileInputRef={fileInputRef}
          />
        )}

        {currentState === 'recording' && (
          <RecordingState
            onStopRecording={handleStopRecording}
            audioLevel={audioLevel}
            liveWords={liveWords}
            captionStyle={captionStyle}
            waveformStyle={waveformStyle}
          />
        )}

        {currentState === 'processing' && (
          <ProcessingState progress={processingProgress} />
        )}

        {currentState === 'export' && (
          <ExportState
            playback={playback}
            exporter={exporter}
            format={format}
            waveformStyle={waveformStyle}
            captionStyle={captionStyle}
            onExport={handleExport}
            onDownload={handleDownload}
            onReset={handleReset}
          />
        )}
      </main>

      <div
        className={cn(
          'fixed bottom-6 right-6 sm:bottom-8 sm:right-8 transition-all duration-200',
          showControls && (currentState === 'idle' || currentState === 'recording')
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-1 pointer-events-none'
        )}
      >
        <WaveformStyleSelector />
      </div>

      <div
        className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 text-white/[0.08] text-[0.6875rem]
                   tracking-[0.2em] uppercase pointer-events-none select-none"
        aria-hidden="true"
      >
        ordio
      </div>
    </div>
  );
}
