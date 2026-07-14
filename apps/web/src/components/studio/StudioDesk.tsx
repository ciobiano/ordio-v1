'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CenterStage } from './CenterStage';
import { RightInspector } from './RightInspector';
import { TimelineStrip } from './TimelineStrip';

export function StudioDesk() {
  const flow = useStudioFlow();
  const playback = usePlayback();

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
    <div className="w-full h-dvh bg-acid-bg-base text-acid-text-1 flex flex-col overflow-hidden">
      <TopBar title="Untitled recording" onExport={flow.goExport} />
      <div className="flex-1 flex min-h-0 relative">
        <LeftRail
          view={flow.view}
          activeSessionId={flow.sessionId}
          onOpenClip={flow.openClip}
          transcript={flow.transcript}
        />
        <CenterStage
          flow={flow}
          sessionData={flow.sessionId ? { sessionId: flow.sessionId } : null}
          audioLevel={audioLevel}
        />
        <RightInspector view={flow.view} audioLevel={audioLevel} onLocked={() => {}} />
      </div>
      <TimelineStrip currentTime={playback.currentTime} duration={playback.duration} onSeek={playback.seek} />
    </div>
  );
}
