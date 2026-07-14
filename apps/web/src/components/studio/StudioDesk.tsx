'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';
import { useSessionHydration } from '@/hooks/studio/useSessionHydration';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CenterStage } from './CenterStage';
import { RightInspector } from './RightInspector';
import { TimelineStrip } from './TimelineStrip';
import { CommandPalette } from './CommandPalette';

export function StudioDesk() {
  const flow = useStudioFlow();
  const playback = usePlayback();
  useSessionHydration(flow.sessionId, playback);

  const [showCmdk, setShowCmdk] = useState(false);

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

  return (
    <div className="w-full h-dvh bg-acid-bg-base text-acid-text-1 flex flex-col overflow-hidden relative">
      <TopBar title="Untitled recording" onExport={flow.goExport} onOpenSearch={() => setShowCmdk(true)} />
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
        />
        <RightInspector view={flow.view} audioLevel={audioLevel} onLocked={() => {}} />
      </div>
      <TimelineStrip currentTime={playback.currentTime} duration={playback.duration} onSeek={playback.seek} />
      <CommandPalette
        open={showCmdk}
        onClose={() => setShowCmdk(false)}
        onExport={flow.goExport}
        onGoLibrary={flow.goIdle}
      />
    </div>
  );
}
