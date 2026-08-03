'use client'

import { useCallback, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/ui/IconToolbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dock } from '@/components/ui/Dock'
import CaptionEditor from '@/components/soul/captions/CaptionEditor'
import StyleControls from '@/components/soul/captions/StyleControls'
import { TrimPanel } from '@/components/soul/editor/TrimPanel'
import { AddPanel } from './AddPanel'
import { SubtitleIcon, PaintBoardIcon, ScissorIcon, CropIcon, PlusSignIcon } from '@hugeicons/core-free-icons'
import type { StyleTabId } from '@/components/soul/captions/StyleControls'
import type { ToolbarPanel } from '@/components/ui/IconToolbar'
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback'
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer'
import type { FeatureKey } from '@/lib/featureGates'

/** Panels that live inside the bottom surface. Reframe is a sheet, not a panel,
 *  and Director is a sheet reached from the transport bar. */
type MobilePanel = 'captions' | 'style' | 'trim' | 'add'

interface ExportControlsProps {
  playback: UsePlaybackReturn
  trimmer: UseAudioTrimmerReturn
  audioBuffer: AudioBuffer | null
  onLocked: (feature: FeatureKey) => void
  onCommit: () => void
  onOpenReframe: () => void
  /** Reframe reflects as active in the dock while its sheet is up. */
  reframeOpen: boolean
}

const DOCK_ITEMS = [
  { id: 'captions', label: 'Captions', icon: SubtitleIcon },
  { id: 'style', label: 'Style', icon: PaintBoardIcon },
  { id: 'trim', label: 'Trim', icon: ScissorIcon },
  { id: 'reframe', label: 'Reframe', icon: CropIcon },
]

/** Fixed heights, matching the design. Add is a three-row menu and needs far
 *  less room than the editors, which scroll. */
const PANEL_HEIGHT: Record<MobilePanel, string> = {
  captions: 'h-[332px]',
  style: 'h-[372px]',
  trim: 'h-[332px]',
  add: 'h-[210px]',
}

const DRAG_CLOSE_OFFSET = 80
const DRAG_CLOSE_VELOCITY = 600

export function ExportControls({
  playback,
  trimmer,
  audioBuffer,
  onLocked,
  onCommit,
  onOpenReframe,
  reframeOpen,
}: ExportControlsProps) {
  const [desktopPanel, setDesktopPanel] = useState<ToolbarPanel>('captions')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('captions')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [styleTab, setStyleTab] = useState<StyleTabId>('motion')
  const dragControls = useDragControls()

  const openPanel = useCallback((panel: MobilePanel) => {
    setMobilePanel(panel)
    setDrawerOpen(true)
  }, [])

  const handleDockItemClick = useCallback(
    (id: string) => {
      if (id === 'reframe') {
        setDrawerOpen(false)
        onOpenReframe()
        return
      }

      const panel = id as MobilePanel
      // Tapping the already-active item collapses the panel back into the dock.
      if (drawerOpen && panel === mobilePanel) {
        setDrawerOpen(false)
        return
      }
      openPanel(panel)
    },
    [drawerOpen, mobilePanel, onOpenReframe, openPanel]
  )

  const handlePickArtwork = useCallback(() => {
    setStyleTab('templates')
    openPanel('style')
  }, [openPanel])

  const trimPanel = (
    <TrimPanel
      audioBuffer={audioBuffer}
      trimmer={trimmer}
      onCommit={onCommit}
      onPreviewAt={playback.previewAt}
      currentTime={playback.currentTime}
    />
  )

  return (
    <>
      {/* Desktop: inline panel */}
      <div
        className={cn(
          panelCard,
          'hidden shrink-0 flex-col overflow-hidden rounded-2xl md:flex md:w-80'
        )}
      >
        <div className="border-b border-white/[0.08]">
          <IconToolbar activePanel={desktopPanel} onPanelChange={setDesktopPanel} />
        </div>
        {desktopPanel === 'captions' ? (
          <div className="min-h-0 flex-1 px-3 pb-4 pt-3">
            <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
          </div>
        ) : (
          <ScrollArea className="flex-1 pb-4">
            <div className="px-3 pt-3">
              {desktopPanel === 'style' && <StyleControls onLocked={onLocked} />}
              {desktopPanel === 'trim' && trimPanel}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Mobile: one bottom surface — the panel grows out of the dock itself
          (grid-rows expansion) rather than layering a separate drawer in front.

          In flow, not fixed: a fixed layer sits under the mobile URL bar when it
          expands, which put the dock partly offscreen. As the last child of a
          dvh-height flex column it stays pinned to the visual viewport, and the
          height it takes is height the stage above gives up — which is what
          makes the canvas shrink as a panel opens. */}
      <div
        className={cn(
          'z-40 shrink-0 overflow-hidden md:hidden',
          'border-t border-white/[0.08] bg-[color:var(--sheet-bg)]',
          'transition-[border-radius] duration-300',
          drawerOpen ? 'rounded-t-[26px] shadow-[0_-8px_40px_rgba(0,0,0,0.5)]' : 'rounded-t-none'
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
              className="flex w-full cursor-pointer touch-none justify-center pb-1 pt-2"
            >
              <span className="h-[5px] w-11 rounded-full bg-white/[0.28]" />
            </button>

            {mobilePanel === 'captions' && (
              <div className={cn(PANEL_HEIGHT.captions, 'min-h-0 px-4 pb-4 pt-3')}>
                <CaptionEditor currentTime={playback.currentTime} onSeek={playback.seek} />
              </div>
            )}

            {mobilePanel === 'style' && (
              <div className={cn(PANEL_HEIGHT.style, 'min-h-0 overflow-hidden px-4 pb-4 pt-3')}>
                {/* Keyed so a deep-link from Add ▸ Pick artwork remounts on the
                    requested tab rather than keeping whatever was last open. */}
                <StyleControls key={styleTab} initialTab={styleTab} onLocked={onLocked} />
              </div>
            )}

            {mobilePanel === 'trim' && (
              <ScrollArea className={cn(PANEL_HEIGHT.trim, 'pb-4')}>
                <div className="px-4 pt-3">{trimPanel}</div>
              </ScrollArea>
            )}

            {mobilePanel === 'add' && (
              <div className={cn(PANEL_HEIGHT.add, 'min-h-0 overflow-y-auto')}>
                <AddPanel
                  onUploadBackdrop={() => onLocked('background_upload')}
                  onPickArtwork={handlePickArtwork}
                />
              </div>
            )}
          </motion.div>
        </div>

        <Dock
          inline
          items={DOCK_ITEMS}
          activeItem={reframeOpen ? 'reframe' : drawerOpen ? mobilePanel : null}
          onItemClick={handleDockItemClick}
          leadingAction={{
            label: 'Add to this canvas',
            icon: PlusSignIcon,
            onClick: () =>
              drawerOpen && mobilePanel === 'add' ? setDrawerOpen(false) : openPanel('add'),
          }}
        />
      </div>
    </>
  )
}
