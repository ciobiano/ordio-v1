'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useTranscription } from '@/hooks/useTranscription';
import { useVideoExporter, fileExtension } from '@/hooks/useVideoExporter';
import { useCapabilities } from '@/hooks/useCapabilities';
import { usePlayback } from '@/hooks/usePlayback';
import { useVAD } from '@/hooks/useVAD';
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
    setAudioBuffer,
    setAudioBlob,
    setAudioDuration,
    setTranscript,
    setLiveWords,
    setShowControls,
    reset,
  } = useStore();

  const [audioLevel, setAudioLevel] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const exporter = useVideoExporter();
  const capabilities = useCapabilities();
  const playback = usePlayback();
  const vad = useVAD(currentState === 'recording');

  const decodeAudioBlob = useCallback(async (blob: Blob): Promise<void> => {
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    setAudioBuffer(decoded);
    setAudioBlob(blob);
    setAudioDuration(decoded.duration);
  }, [setAudioBuffer, setAudioBlob, setAudioDuration]);

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

  useEffect(() => {
    setLiveWords(transcription.liveWords);
  }, [transcription.liveWords, setLiveWords]);

  useEffect(() => {
    if (currentState !== 'export') return;
    const { audioBuffer } = useStore.getState();
    if (audioBuffer) playback.load(audioBuffer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState]);

  useEffect(() => {
    if (recorder.state !== 'stopped' || !recorder.audioBlob) return;

    const processRecordedAudio = async () => {
      setCurrentState('processing');
      setProcessingProgress(0);
      setProcessingStep(0);
      try {
        // Step 1: Analyze audio
        setProcessingStep(0);
        setProcessingProgress(10);
        await decodeAudioBlob(recorder.audioBlob!);
        setProcessingProgress(30);

        // Step 2: Transcribe with Whisper API
        setProcessingStep(1);
        setProcessingProgress(35);
        transcription.stopLiveTranscription();
        const whisperWords = await transcription.transcribeAudio(recorder.audioBlob!);
        setProcessingProgress(85);

        // Step 3: Prepare captions
        setProcessingStep(2);
        setTranscript(whisperWords.length > 0 ? whisperWords : transcription.transcript);
        setProcessingProgress(100);
        setTimeout(() => setCurrentState('export'), 300);
      } catch (err) {
        console.error('Processing failed:', err);
        setCurrentState('idle');
      }
    };

    processRecordedAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state, recorder.audioBlob]);

  const handleStartRecording = useCallback(async () => {
    transcription.clearTranscript();
    await recorder.startRecording();
    transcription.startLiveTranscription();
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

      setCurrentState('processing');
      setProcessingProgress(0);
      setProcessingStep(0);
      try {
        // Step 1: Analyze audio
        setProcessingStep(0);
        setProcessingProgress(10);
        await decodeAudioBlob(file);
        setProcessingProgress(30);

        // Step 2: Transcribe with Whisper API
        setProcessingStep(1);
        setProcessingProgress(35);
        const whisperWords = await transcription.transcribeAudio(file);
        setProcessingProgress(85);

        // Step 3: Prepare captions
        setProcessingStep(2);
        setTranscript(whisperWords);
        setProcessingProgress(100);
        setTimeout(() => setCurrentState('export'), 300);
      } catch {
        alert('Failed to load audio file. Please try MP3, WAV, or M4A.');
        setCurrentState('idle');
      }

      if (e.target) e.target.value = '';
    },
    [setCurrentState, decodeAudioBlob]
  );

  const handleExport = useCallback(async () => {
    const { audioBuffer } = useStore.getState();
    if (!audioBuffer) return;

    const canvas = document.createElement('canvas');
    canvas.width = format === 'vertical' ? 1080 : 1920;
    canvas.height = format === 'vertical' ? 1920 : 1080;
    exportCanvasRef.current = canvas;

    const canvasCtx = canvas.getContext('2d');
    if (canvasCtx) {
      canvasCtx.fillStyle = '#000000';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
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
    audioContextRef.current?.close();
    audioContextRef.current = null;
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
            isSpeaking={vad.isSpeaking}
          />
        )}

        {currentState === 'processing' && (
          <ProcessingState progress={processingProgress} step={processingStep} />
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
