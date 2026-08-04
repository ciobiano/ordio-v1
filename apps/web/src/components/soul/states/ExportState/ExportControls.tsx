'use client'

import { useCallback, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import { cn } from '@/lib/utils'
import { panelCard } from '@/lib/variants'
import { IconToolbar } from '@/components/ui/IconToolbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dock } from '@/components/ui/Dock'
import CaptionEditor from '@/components/soul/captions/CaptionEditor'
import StyleControls from '@/components/soul/captions/StyleControls'
import { TrimPanel } from '@/components/soul/editor/TrimPanel'
import { AddPanel } from './AddPanel'
import { shouldCloseOnGrabStripClick } from './grabStripIntent'
import { shouldStartSheetDrag } from './sheetDragIntent'
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
  /** Whether a bottom panel is expanded. Owned by the parent, because the
   *  canvas above has to react to it — it shrinks, and its play badge hides. */
  drawerOpen: boolean
  onDrawerOpenChange: (open: boolean) => void
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

/**
 * The iOS sheet curve, and the one vaul animates Reframe with. Decelerates hard
 * and settles without overshoot, which is what reads as "smooth" — a spring
 * wobbles at the end, and next to Reframe that wobble is the whole difference.
 * Already used by the grid-rows collapse below, so the two now share it.
 */
const SHEET_EASE = [0.32, 0.72, 0, 1] as const
/** Springing back after a drag that did not dismiss. vaul's own duration. */
const SHEET_SETTLE_SEC = 0.5
/** Returning to rest while the panel collapses — matched to it, not racing it. */
const SHEET_COLLAPSE_SEC = 0.3

export function ExportControls({
  playback,
  trimmer,
  audioBuffer,
  onLocked,
  onCommit,
  onOpenReframe,
  reframeOpen,
  drawerOpen,
  onDrawerOpenChange: setDrawerOpen,
}: ExportControlsProps) {
  const [desktopPanel, setDesktopPanel] = useState<ToolbarPanel>('captions')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('captions')
  const [styleTab, setStyleTab] = useState<StyleTabId>('motion')
  const dragControls = useDragControls()
  /**
   * Driven by hand rather than by dragSnapToOrigin, which only springs. The
   * release has to land on the same curve as the collapse underneath it or the
   * two visibly disagree.
   */
  const y = useMotionValue(0)

  // The grab strip is both a drag handle and a tap-to-close button, and now that
  // the sheet tracks the thumb 1:1 those two roles collide. The strip moves with
  // the pointer, so the pointer is still over it on release and the browser fires
  // a click — meaning a short drag that should spring back also closes the panel.
  // Set on drag start, consumed by the click handler.
  const didDragRef = useRef(false)
  const surfaceRef = useRef<HTMLDivElement>(null)

  /**
   * Arm the sheet drag from anywhere on the panel that is not busy scrolling.
   *
   * Only arms it — framer will not move anything until the pointer travels past
   * its own threshold, so a tap on a tab or a toggle still reads as a tap and
   * its click still fires.
   */
  const handleSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const surface = surfaceRef.current
      if (!surface) return
      if (!shouldStartSheetDrag(event.target as Element | null, surface)) return

      didDragRef.current = false
      dragControls.start(event)
    },
    [dragControls]
  )

  const openPanel = useCallback(
    (panel: MobilePanel) => {
      setMobilePanel(panel)
      setDrawerOpen(true)
    },
    [setDrawerOpen]
  )

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
    [drawerOpen, mobilePanel, onOpenReframe, openPanel, setDrawerOpen]
  )

  /** Tap the grab strip to close. Must not fire as the tail of a drag. */
  const handleGrabStripClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (shouldCloseOnGrabStripClick({ detail: event.detail, didDrag: didDragRef.current })) {
        setDrawerOpen(false)
        return
      }
      // Consume it, so the next tap on the strip is read as a tap.
      didDragRef.current = false
    },
    [setDrawerOpen]
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
      <motion.div
        className={cn(
          'z-40 shrink-0 overflow-hidden md:hidden',
          'border-t border-white/[0.08] bg-[color:var(--sheet-bg)]',
          // rounded-t-4xl and the same shadow Reframe uses, so the two read as
          // one family — Reframe floats inset on all four corners because vaul
          // is fixed; this one is in flow and anchored, so only the top pair
          // rounds. The shadow is in the transition rather than snapping on,
          // and both run the sheet curve, matching the collapse below.
          'transition-[border-radius,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          drawerOpen
            ? 'rounded-t-4xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]'
            : 'rounded-t-none shadow-none'
        )}
        // The whole surface is what moves, not the panel inside it. Dragging
        // the inner content went nowhere visible: it lives inside the
        // overflow-hidden box that the grid-rows collapse needs, so every pixel
        // of travel was clipped and the gesture felt dead.
        drag={drawerOpen ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        // Downward only — this sheet has nowhere to go up.
        //
        // bottom: 1 is what makes the gesture feel alive. Constraints of 0/0 mean
        // the sheet has no real travel at all: every pixel is overshoot past the
        // constraint, and dragElastic scales it. At 0.55 a 100px thumb drag moved
        // the sheet ~55px against rising resistance, which reads as stiff rather
        // than as damped. At 1 the surface tracks the thumb exactly.
        //
        // Resistance belongs at the boundary, not across the travel — that is what
        // top: 0 is: a hard stop upward, where the sheet genuinely cannot go.
        dragElastic={{ top: 0, bottom: 1 }}
        dragMomentum={false}
        style={{ y }}
        onDragStart={() => {
          didDragRef.current = true
        }}
        onDragEnd={(_, info) => {
          // Velocity as well as distance, so a quick flick dismisses without
          // having to travel the full threshold — the flick is the whole reason
          // Reframe feels lighter than this did.
          const dismissing =
            info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY

          if (dismissing) setDrawerOpen(false)

          // Return to rest on the same curve either way. When dismissing, match
          // the collapse's duration so the surface and the height it occupies
          // resolve together instead of one finishing under the other.
          animate(y, 0, {
            duration: dismissing ? SHEET_COLLAPSE_SEC : SHEET_SETTLE_SEC,
            ease: SHEET_EASE,
          })
        }}
      >
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            drawerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          {/* The drag zone is the whole panel, minus whatever is scrolling.
              Reframe is a vaul drawer and closes from any swipe; these panels
              are in flow so the canvas can shrink into them, which means a
              hand-rolled gesture — and it used to start only on the grab strip,
              leaving the rest of the surface feeling dead. shouldStartSheetDrag
              decides per pointer, so the strip, the tab row and every static
              header now drag, while a live scroller keeps its own gesture. */}
          <div
            ref={surfaceRef}
            className="min-h-0 overflow-hidden"
            onPointerDown={handleSurfacePointerDown}
          >
            {/* Full-width 44px grab strip. The pill is only the visible part —
                the target is the whole band, so the gesture is findable with a
                thumb. touch-none keeps the browser from claiming the drag as a
                scroll before framer sees it. */}
            <button
              type="button"
              aria-label="Close panel"
              onClick={handleGrabStripClick}
              className={cn(
                'flex h-11 w-full touch-none items-center justify-center',
                'cursor-grab active:cursor-grabbing'
              )}
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
          </div>
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
      </motion.div>
    </>
  )
}
