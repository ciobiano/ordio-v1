'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@Ordio/convex';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';
import { useSessionHydration } from '@/hooks/studio/useSessionHydration';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { useUIStore } from '@/stores';
import { useCheckout } from '@/hooks/billing/useCheckout';
import { validateFile, FILE_ERROR_MESSAGES } from '@/lib/fileValidation';
import UpgradeSheet from '@/components/soul/modals/UpgradeSheet';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CenterStage } from './CenterStage';
import { RightInspector } from './RightInspector';
import { TimelineStrip } from './TimelineStrip';
import { CommandPalette, type PaletteAction } from './CommandPalette';
import type { GenericId } from 'convex/values';

export function StudioDesk() {
  const flow = useStudioFlow();
  const playback = usePlayback();
  useSessionHydration(flow.sessionId, playback);

  const [showCmdk, setShowCmdk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const upgradeTarget = useUIStore((s) => s.upgradeTarget);
  const setUpgradeTarget = useUIStore((s) => s.setUpgradeTarget);
  const setCaptionMode = useUIStore((s) => s.setCaptionMode);
  const setFormat = useUIStore((s) => s.setFormat);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const { startCheckout } = useCheckout();

  const session = useQuery(
    api.sessions.getSession,
    flow.sessionId ? { sessionId: flow.sessionId as GenericId<'sessions'> } : 'skip'
  );
  const title =
    session?.title ??
    (flow.view === 'capture' || flow.view === 'processing' ? 'New recording' : 'Ordio Studio');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCmdk((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The whole window is a dropzone in every state.
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      const error = validateFile(file);
      if (error) {
        toast.error(FILE_ERROR_MESSAGES[error]);
        return;
      }
      void flow.processFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [flow]);

  // Single audio-level poll for the whole desk — both CenterStage's live
  // waveform and RightInspector's level meter read this one value.
  const [audioLevel, setAudioLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (flow.view !== 'capture') {
      setAudioLevel(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setAudioLevel(flow.getAudioLevel());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flow.view, flow.getAudioLevel]);

  // Every palette action is real and wired — the registry proper is Slice 3;
  // this seeds it with the store-backed verbs that already exist.
  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: 'record', label: 'New recording', icon: '●', run: () => void flow.startRecording() },
      { id: 'upload', label: 'Upload audio or video', icon: '⤓', run: () => fileInputRef.current?.click() },
      { id: 'export', label: 'Export clip', icon: '↗', run: flow.goExport },
      { id: 'library', label: 'Go to Library', icon: '☰', run: flow.goIdle },
      { id: 'cap-karaoke', label: 'Set caption style → Karaoke', icon: 'A', run: () => setCaptionMode('karaoke') },
      { id: 'cap-phrase', label: 'Set caption style → Phrase', icon: 'A', run: () => setCaptionMode('phrase') },
      { id: 'cap-stack', label: 'Set caption style → Stack', icon: 'A', run: () => setCaptionMode('stack') },
      { id: 'fmt-vertical', label: 'Set format → 9:16 Reels', icon: '▯', run: () => setFormat('vertical') },
      { id: 'fmt-square', label: 'Set format → 1:1 Square', icon: '□', run: () => setFormat('square') },
      { id: 'fmt-horizontal', label: 'Set format → 16:9 YouTube', icon: '▭', run: () => setFormat('horizontal') },
      { id: 'wave-bars', label: 'Set waveform → Bars', icon: '‖', run: () => setWaveformStyle('bars') },
      { id: 'wave-circle', label: 'Set waveform → Circle', icon: '◯', run: () => setWaveformStyle('circle') },
    ],
    [flow, setCaptionMode, setFormat, setWaveformStyle]
  );

  return (
    <div className="w-full h-dvh bg-acid-bg-base text-acid-text-1 flex flex-col overflow-hidden relative">
      <TopBar title={title} onExport={flow.goExport} onOpenSearch={() => setShowCmdk(true)} />
      <div className="flex-1 flex min-h-0 relative">
        <LeftRail
          view={flow.view}
          activeSessionId={flow.sessionId}
          onOpenClip={flow.openClip}
          onGoIdle={flow.goIdle}
          transcript={flow.transcript}
        />
        <CenterStage
          flow={flow}
          sessionData={flow.sessionId ? { sessionId: flow.sessionId } : null}
          audioLevel={audioLevel}
          playback={playback}
          onOpenPalette={() => setShowCmdk(true)}
        />
        <RightInspector
          view={flow.view}
          audioLevel={audioLevel}
          mics={flow.mics}
          onLocked={setUpgradeTarget}
        />
      </div>
      <TimelineStrip currentTime={playback.currentTime} duration={playback.duration} onSeek={playback.seek} />
      <CommandPalette open={showCmdk} onClose={() => setShowCmdk(false)} actions={paletteActions} />

      {isDragging && (
        <div className="absolute inset-0 z-40 bg-acid-bg-base/75 backdrop-blur-sm flex items-center justify-center p-10 pointer-events-none">
          <div className="w-full h-full border-3 border-dashed border-acid-text-1 rounded-acid-lg flex flex-col items-center justify-center gap-4 bg-acid-surface-1/40">
            <div className="text-5xl" aria-hidden="true">⤓</div>
            <div className="font-acid-display font-semibold text-[34px] text-acid-text-1">
              Drop audio or video
            </div>
            <div className="text-[15px] text-acid-text-3">
              MP3, WAV, MP4, MOV — we&apos;ll transcribe it instantly.
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4a"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          const error = validateFile(file);
          if (error) {
            toast.error(FILE_ERROR_MESSAGES[error]);
            return;
          }
          void flow.processFile(file);
        }}
      />

      <UpgradeSheet
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        feature={upgradeTarget === 'export_limit' ? undefined : (upgradeTarget ?? undefined)}
        onUpgrade={() =>
          startCheckout('creator').catch(() => toast.error('Checkout failed. Please try again.'))
        }
      />
    </div>
  );
}
