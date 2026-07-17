'use client';

import dynamic from 'next/dynamic';
import { motion, useDragControls } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import type { FeatureKey } from '@/lib/featureGates';
import { CaptureHeader } from './CaptureHeader';
import { CaptureStage } from './CaptureStage';
import { CaptureCaptions } from './CaptureCaptions';
import { CaptureDock } from './CaptureDock';
import { CaptureSidebar } from './CaptureSidebar';
import { UploadActionSheet } from './UploadActionSheet';
import { deriveCapturePhase } from './phase';
import { computeSidebarRevealPx } from './sidebarReveal';
import type { RecordingSubPhase } from './types';

const RecordingSettingsSheet = dynamic(
  () => import('@/components/soul/recording/RecordingSettingsSheet').then((m) => ({ default: m.RecordingSettingsSheet })),
  { ssr: false }
);

const EASE = [0.32, 0.72, 0, 1] as const;
const FALLBACK_CONTAINER_PX = 440; // matches the outer container's max-w-[440px]

interface CaptureScreenProps {
  currentState: 'idle' | 'recording' | 'processing';
  audioLevel: number;
  isSpeaking: boolean;
  isStarting: boolean;
  micDenied: boolean;
  canRecord: boolean;
  processingProgress: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isPaused: boolean;
  committedCaptionLines: string[];
  interimCaptionText: string;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onRestart: () => void;
  onProceed: () => void;
  onCancel: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export function CaptureScreen({
  currentState,
  audioLevel,
  isSpeaking,
  isStarting,
  micDenied,
  canRecord,
  processingProgress,
  fileInputRef,
  onFileUpload,
  isPaused,
  committedCaptionLines,
  interimCaptionText,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onRestart,
  onProceed,
  onCancel,
  onLocked,
}: CaptureScreenProps) {
  const [recordingSubPhase, setRecordingSubPhase] = useState<RecordingSubPhase>('recording');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const { trigger } = useHaptics();

  const pressActiveRef = useRef(false);
  const pressStartRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [revealPx, setRevealPx] = useState(() => computeSidebarRevealPx(FALLBACK_CONTAINER_PX));

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateRevealPx = () => setRevealPx(computeSidebarRevealPx(node.offsetWidth));
    updateRevealPx();
    const observer = new ResizeObserver(updateRevealPx);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const phase = deriveCapturePhase({ currentState, recordingSubPhase, isPaused });

  // Matches the mockup's onPrimaryDown/finishPress model: pressing down starts recording
  // immediately (no artificial hold delay — a plain tap must work), and a long hold that's
  // still active on release auto-advances straight to 'ready', as a quick-finish shortcut.
  const handlePrimaryDown = useCallback(() => {
    if (!canRecord || isStarting || micDenied || phase !== 'idle') return;
    pressActiveRef.current = true;
    pressStartRef.current = Date.now();
    setRecordingSubPhase('recording');
    onStartRecording();
  }, [canRecord, isStarting, micDenied, phase, onStartRecording]);

  const handleGoReady = useCallback(() => {
    trigger('heavy');
    setRecordingSubPhase('stopped');
    onStopRecording();
  }, [onStopRecording, trigger]);

  // A press started from idle that's still held past this threshold on release auto-advances
  // to 'ready' — a quick-finish shortcut. A plain tap just leaves the recording running.
  const PRESS_AUTO_FINISH_MS = 350;
  const finishPress = useCallback(() => {
    if (!pressActiveRef.current) return;
    pressActiveRef.current = false;
    const held = Date.now() - pressStartRef.current;
    if (held > PRESS_AUTO_FINISH_MS) handleGoReady();
  }, [handleGoReady]);

  const handlePause = useCallback(() => {
    trigger('light');
    onPauseRecording();
  }, [onPauseRecording, trigger]);

  const handleResume = useCallback(() => {
    trigger('medium');
    onResumeRecording();
  }, [onResumeRecording, trigger]);

  const handleRestart = useCallback(() => {
    trigger('medium');
    setRecordingSubPhase('recording');
    onRestart();
  }, [onRestart, trigger]);

  const handleProcess = useCallback(() => {
    trigger('success');
    onProceed();
  }, [onProceed, trigger]);

  const handleCancel = useCallback(() => {
    trigger('medium');
    setRecordingSubPhase('recording');
    onCancel();
  }, [onCancel, trigger]);

  const handleBack = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  const closeFiles = useCallback(() => setFilesOpen(false), []);

  const handleSidebarDragEnd = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const draggedTo = (filesOpen ? revealPx : 0) + info.offset.x;
      setFilesOpen(draggedTo > revealPx / 2);
    },
    [filesOpen, revealPx]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[440px] h-dvh min-h-[720px] mx-auto overflow-hidden select-none"
      style={{ perspective: '1400px' }}
    >
      {/* Sidebar sits behind the page at all times; revealed as the page slides right.
          Its width matches the reveal distance — content laid out at full container
          width would put row actions (e.g. swipe-to-delete) under the covering page. */}
      <div className="absolute inset-y-0 left-0 z-1 bg-[color:var(--sheet-bg)]" style={{ width: revealPx }}>
        <CaptureSidebar
          onOpenUpload={() => setUploadOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={closeFiles}
        />
      </div>

      {!filesOpen && (
        <div
          role="button"
          aria-label="Open recordings by swiping"
          className="absolute left-0 top-0 bottom-0 z-3 w-6"
          onPointerDown={(e) => dragControls.start(e)}
        />
      )}

      <motion.div
        className="absolute inset-0 z-2 bg-black text-white overflow-hidden"
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: revealPx }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleSidebarDragEnd}
        animate={{ x: filesOpen ? revealPx : 0 }}
        transition={{ duration: 0.44, ease: EASE }}
        style={{
          borderTopLeftRadius: filesOpen ? 44 : 0,
          borderBottomLeftRadius: filesOpen ? 44 : 0,
          boxShadow: filesOpen ? '-18px 0 40px rgba(0,0,0,.55)' : 'none',
        }}
      >
        {filesOpen && (
          <button
            type="button"
            aria-label="Close recordings"
            onClick={closeFiles}
            onPointerDown={(e) => dragControls.start(e)}
            className="absolute inset-0 z-100 border-none bg-transparent cursor-default"
          />
        )}

        <CaptureHeader phase={phase} onOpenFiles={() => setFilesOpen(true)} onBack={handleBack} />

        <CaptureStage
          phase={phase}
          audioLevel={audioLevel}
          isSpeaking={isSpeaking}
          // Orb only wires up pointer handlers when onClick is present (see Orb.tsx) — the click
          // itself is a no-op here since pointerdown/pointerup already handle start/finish.
          onOrbClick={() => {}}
          onOrbPressStart={handlePrimaryDown}
          onOrbPressEnd={finishPress}
        />

        {(phase === 'recording' || phase === 'paused') && (
          <CaptureCaptions committedLines={committedCaptionLines} interimText={interimCaptionText} />
        )}

        <CaptureDock
          phase={phase}
          progress={processingProgress}
          onOpenUpload={() => setUploadOpen(true)}
          onRecordPressStart={handlePrimaryDown}
          onRecordPressEnd={finishPress}
          onOpenSettings={() => setSettingsOpen(true)}
          onGoReady={handleGoReady}
          onProcess={handleProcess}
          onPause={handlePause}
          onResume={handleResume}
          onRestart={handleRestart}
          onCancel={handleCancel}
        />

        <UploadActionSheet isOpen={uploadOpen} onClose={() => setUploadOpen(false)} fileInputRef={fileInputRef} />

        <RecordingSettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onLocked={onLocked} />

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4a"
          className="hidden"
          onChange={onFileUpload}
        />
      </motion.div>
    </div>
  );
}
