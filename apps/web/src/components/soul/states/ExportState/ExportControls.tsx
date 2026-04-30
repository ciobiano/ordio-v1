'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/ui/IconToolbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dock } from '@/components/ui/Dock'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import CaptionEditor from '@/components/soul/captions/CaptionEditor'
import StyleControls from '@/components/soul/captions/StyleControls'
import { TrimPanel } from '@/components/soul/editor/TrimPanel'
import FormatToggle from '@/components/soul/shared/FormatToggle'
import { SubtitleIcon, PaintBoardIcon, ScissorIcon, ResizeIcon } from '@hugeicons/core-free-icons'
import type { ToolbarPanel } from '@/components/ui/IconToolbar'
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

const DOCK_ITEMS = [
  { id: 'captions', label: 'Captions', icon: SubtitleIcon },
  { id: 'style',    label: 'Style',    icon: PaintBoardIcon },
  { id: 'trim',     label: 'Trim',     icon: ScissorIcon },
  { id: 'format',   label: 'Format',   icon: ResizeIcon },
]

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
  const [desktopPanel, setDesktopPanel] = useState<ToolbarPanel>('captions')
  const [mobilePanel, setMobilePanel] = useState<ToolbarPanel>('captions')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleDockItemClick = useCallback((id: string) => {
    const panelId = id as ToolbarPanel
    setMobilePanel(panelId)
    setDrawerOpen(true)
  }, [])

  return (
    <>
      {/* Desktop: Inline panel */}
      <div className={cn(
        panelCard,
        'hidden md:flex flex-col overflow-hidden rounded-2xl md:w-80 shrink-0'
      )}>
        <div className="border-b border-white/[0.08]">
          <IconToolbar activePanel={desktopPanel} onPanelChange={setDesktopPanel} />
        </div>
        <ScrollArea className="flex-1 pb-4">
          <div className="px-3 pt-3">
            {desktopPanel === 'captions' && (
              <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
            )}
            {desktopPanel === 'style' && <StyleControls onLocked={onLocked} />}
            {desktopPanel === 'trim' && (
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

      {/* Mobile: Dock (bottom bar) + Drawer (sheet) */}
      <Dock
        items={DOCK_ITEMS}
        activeItem={drawerOpen ? mobilePanel : null}
        onItemClick={handleDockItemClick}
      />

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="md:hidden p-0 bg-[color:var(--glass-bg)] backdrop-blur-xl border-t border-white/[0.08]">
          <DrawerTitle className="sr-only">Export Tools</DrawerTitle>
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-white/20" />
          </div>

          {/* Panel Content (no TabBar - Dock is the tab bar) */}
          <ScrollArea className="h-[50vh] pb-4">
            <div className="px-4 pt-4">
              {mobilePanel === 'captions' && (
                <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
              )}
              {mobilePanel === 'style' && <StyleControls onLocked={onLocked} />}
              {mobilePanel === 'trim' && (
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
              {mobilePanel === 'format' && <FormatToggle onLocked={onLocked} />}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  )
}
