'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/primitives/IconToolbar'
import type { ToolbarPanel } from '@/components/primitives/IconToolbar'
import CaptionEditor from '@/components/soul/CaptionEditor'
import StyleControls from '@/components/soul/StyleControls'
import FormatToggle from '@/components/soul/FormatToggle'
import { TrimPanel } from '@/components/soul/TrimPanel'
import type { UsePlaybackReturn } from '@/hooks/usePlayback'
import type { UseAudioTrimmerReturn } from '@/hooks/useAudioTrimmer'
import type { FeatureKey } from '@/lib/featureGates'
import type { Word } from '@Ordio/shared/schemas'

interface ExportControlsProps {
  playback: UsePlaybackReturn
  trimmer: UseAudioTrimmerReturn
  audioBuffer: AudioBuffer | null
  transcript: Word[]
  onLocked: (feature: FeatureKey) => void
}

export function ExportControls({
  playback,
  trimmer,
  audioBuffer,
  transcript,
  onLocked,
}: ExportControlsProps) {
  const [activePanel, setActivePanel] = useState<ToolbarPanel>('captions')

  return (
    <div className={cn(
      'flex flex-col md:w-72 shrink-0',
      'md:border md:border-border md:rounded-xl md:overflow-hidden md:bg-muted'
    )}>
      <div className="border-t border-border mt-1 md:border-t-0 md:mt-0 md:border-b md:border-border">
        <IconToolbar activePanel={activePanel} onPanelChange={setActivePanel} />
      </div>

      <div className={cn(
        panelCard,
        'mx-4 mb-4 mt-2 px-4 py-4',
        'md:mx-0 md:mb-0 md:mt-0 md:rounded-none md:border-0 md:bg-transparent'
      )}>
        {activePanel === 'captions' && (
          <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
        )}
        {activePanel === 'style' && <StyleControls onLocked={onLocked} />}
        {activePanel === 'format' && <FormatToggle onLocked={onLocked} />}
        {activePanel === 'trim' && (
          <TrimPanel
            audioBuffer={audioBuffer}
            transcript={transcript}
            trimmer={trimmer}
            onSeek={playback.seek}
          />
        )}
      </div>
    </div>
  )
}
