'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/ui/IconToolbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ToolbarPanel } from '@/components/ui/IconToolbar'
import CaptionEditor from '@/components/soul/captions/CaptionEditor'
import StyleControls from '@/components/soul/captions/StyleControls'
import { TrimPanel } from '@/components/soul/editor/TrimPanel'
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback'
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer'
import type { FeatureKey } from '@/lib/featureGates'
import type { Word } from '@Ordio/shared/schemas'

interface ExportControlsProps {
  playback: UsePlaybackReturn
  trimmer: UseAudioTrimmerReturn
  audioBuffer: AudioBuffer | null
  transcript: Word[]
  onLocked: (feature: FeatureKey) => void
  onCommit: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function ExportControls({
  playback,
  trimmer,
  audioBuffer,
  transcript,
  onLocked,
  onCommit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ExportControlsProps) {
  const [activePanel, setActivePanel] = useState<ToolbarPanel>('captions')

  return (
    <div className={cn(
      'mobile-glass flex flex-col overflow-hidden rounded-[1.8rem] md:w-80 shrink-0',
      'border border-white/10'
    )}>
      <div className="border-b border-white/10">
        <IconToolbar activePanel={activePanel} onPanelChange={setActivePanel} />
      </div>

      <div className={cn(
        panelCard,
        'flex flex-col overflow-hidden border-0 bg-transparent',
        'h-[48vh] min-h-[360px] md:h-[560px]',
        'mx-0 mb-0 mt-0'
      )}>
        <ScrollArea className="h-full px-3 pb-4">
          <div className="pt-3">
            {activePanel === 'captions' && (
              <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
            )}
            {activePanel === 'style' && <StyleControls onLocked={onLocked} />}
            {activePanel === 'trim' && (
              <TrimPanel
                audioBuffer={audioBuffer}
                trimmer={trimmer}
                onCommit={onCommit}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onPreviewAt={playback.previewAt}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
