'use client'

import { useState, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/ui/IconToolbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dock } from '@/components/ui/Dock'
import CaptionEditor from '@/components/soul/captions/CaptionEditor'
import StyleControls from '@/components/soul/captions/StyleControls'
import { DirectorSheet } from '@/components/soul/captions/DirectorSheet'
import { TrimPanel } from '@/components/soul/editor/TrimPanel'
import FormatToggle from '@/components/soul/shared/FormatToggle'
import { SubtitleIcon, PaintBoardIcon, ScissorIcon, CropIcon, AiMagicIcon } from '@hugeicons/core-free-icons'
import type { ToolbarPanel } from '@/components/ui/IconToolbar'
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback'
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer'
import type { FeatureKey } from '@/lib/featureGates'

interface ExportControlsProps {
  playback: UsePlaybackReturn
  trimmer: UseAudioTrimmerReturn
  audioBuffer: AudioBuffer | null
  onLocked: (feature: FeatureKey) => void
  onCommit: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const DOCK_ITEMS = [
  { id: 'director', label: 'Direct it', icon: AiMagicIcon },
  { id: 'captions', label: 'Captions', icon: SubtitleIcon },
  { id: 'style',    label: 'Edit Style', icon: PaintBoardIcon },
  { id: 'trim',     label: 'Trim',     icon: ScissorIcon },
  { id: 'format',   label: 'Reframe',   icon: CropIcon },
]

// Sparse panels (few options, no internal scrolling need) get a shorter sheet
// instead of the same fixed height as dense ones — avoids the dead empty
// space a short option list left in a tall sheet.
const COMPACT_PANELS = new Set<ToolbarPanel>(['format'])
function panelHeightClass(panel: ToolbarPanel): string {
  return COMPACT_PANELS.has(panel) ? 'h-[26vh]' : 'h-[46vh]'
}

const DRAG_CLOSE_OFFSET = 80
const DRAG_CLOSE_VELOCITY = 600

export function ExportControls({
  playback,
  trimmer,
  audioBuffer,
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
  const [directorOpen, setDirectorOpen] = useState(false)
  const dragControls = useDragControls()

  const handleDockItemClick = useCallback((id: string) => {
    if (id === 'director') {
      setDirectorOpen(true)
      return
    }
    const panelId = id as ToolbarPanel
    // Tapping the already-active item collapses the panel back into the dock.
    if (drawerOpen && panelId === mobilePanel) {
      setDrawerOpen(false)
      return
    }
    setMobilePanel(panelId)
    setDrawerOpen(true)
  }, [drawerOpen, mobilePanel])

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
        {desktopPanel === 'captions' ? (
          <div className="flex-1 min-h-0 px-3 pt-3 pb-4">
            <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
          </div>
        ) : (
          <ScrollArea className="flex-1 pb-4">
            <div className="px-3 pt-3">
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
        )}
      </div>

      {/* Mobile: one bottom surface — the panel grows out of the dock itself
          (grid-rows expansion) instead of a separate drawer layering in front. */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div
          className={cn(
            'overflow-hidden border-t border-white/[0.08] bg-[color:var(--sheet-bg)]',
            'transition-[border-radius] duration-300',
            drawerOpen ? 'rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]' : 'rounded-t-none'
          )}
        >
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              drawerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <motion.div
              className="min-h-0 overflow-hidden"
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY) {
                  setDrawerOpen(false)
                }
              }}
            >
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setDrawerOpen(false)}
                onPointerDown={(e) => dragControls.start(e)}
                className="flex w-full cursor-pointer justify-center pt-2 pb-1 touch-none"
              >
                <span className="h-1.5 w-12 rounded-full bg-white/20" />
              </button>

              {/* Panel Content (no TabBar - Dock is the tab bar) */}
              {mobilePanel === 'captions' ? (
                <div className={cn(panelHeightClass(mobilePanel), 'min-h-0 px-4 pt-3 pb-4')}>
                  <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
                </div>
              ) : mobilePanel === 'style' ? (
                <div className={cn(panelHeightClass(mobilePanel), 'min-h-0 overflow-hidden px-4 pt-3 pb-4')}>
                  <StyleControls onLocked={onLocked} />
                </div>
              ) : (
                <ScrollArea className={cn(panelHeightClass(mobilePanel), 'pb-4')}>
                  <div className="px-4 pt-3">
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
              )}
            </motion.div>
          </div>

          <Dock
            inline
            items={DOCK_ITEMS}
            activeItem={drawerOpen ? mobilePanel : null}
            onItemClick={handleDockItemClick}
          />
        </div>
      </div>

      <DirectorSheet
        isOpen={directorOpen}
        onClose={() => setDirectorOpen(false)}
        onLocked={onLocked}
      />
    </>
  )
}
