'use client'

import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import { ordStickerBtn } from '@/lib/ordioVariants'

type DockItem = {
  id: string
  label: string
  icon: IconSvgElement
}

type DockLeadingAction = {
  label: string
  icon: IconSvgElement
  onClick: () => void
}

interface DockProps {
  items: DockItem[]
  activeItem: string | null
  onItemClick: (id: string) => void
  /** Circular sticker button pinned to the left of the tabs — the Add FAB.
   *  It is an action, not a tab, so it never takes the active state. */
  leadingAction?: DockLeadingAction
  /** Render as a plain row inside a parent surface (the parent owns
   * positioning + background) instead of a self-positioned fixed bar. */
  inline?: boolean
}

export function Dock({ items, activeItem, onItemClick, leadingAction, inline = false }: DockProps) {
  return (
    <nav
      className={cn(
        // overflow-hidden is the backstop: the FAB plus four labelled items is
        // wider than a 320px phone, and without it the last item escapes the
        // screen instead of the row tightening.
        'flex items-center gap-1 overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden',
        inline
          ? 'relative'
          : 'fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[color:var(--sheet-bg)]'
      )}
      role="toolbar"
      aria-label="Export tools"
      style={{ height: 'calc(66px + env(safe-area-inset-bottom) + 8px)' }}
    >
      {leadingAction && (
        <button
          type="button"
          onClick={leadingAction.onClick}
          aria-label={leadingAction.label}
          // Raised, explicitly: the FAB reads as sitting on the canvas rather
          // than inside the dock, so it is one of the few places the sticker
          // press has a surface to peel off.
          className={cn(
            ordStickerBtn({ tone: 'paper', shape: 'round', size: 'icon', elevation: 'raised' }),
            'shrink-0'
          )}
        >
          <HugeiconsIcon icon={leadingAction.icon} size={24} strokeWidth={2.6} />
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-center justify-around">
        {items.map((item) => {
          const isActive = activeItem === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              aria-label={item.label}
              aria-pressed={isActive}
              className={cn(
                'flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 px-1 py-1',
                'transition-colors duration-[var(--acid-dur-tap)]',
                // Paper, not lime. A dock item marks position, and position is
                // never the accent's job (DESIGN.md §4) — the accent has no
                // luminance headroom over paper, so using it here just puts a
                // second shout next to the Export button.
                isActive
                  ? 'text-[color:var(--acid-text-1)]'
                  : 'text-[color:var(--acid-text-3)] hover:text-[color:var(--acid-text-1)]/85'
              )}
            >
              {/* Weight carries what colour used to. 42% → 100% ink is a real
                  step on its own, and the heavier stroke makes the glyph read as
                  selected rather than merely brighter — with the open panel
                  underneath as the primary signal either way. */}
              <HugeiconsIcon
                icon={item.icon}
                size={23}
                strokeWidth={isActive ? 2.4 : 1.9}
                aria-hidden="true"
                className="shrink-0"
              />
              {/* Truncates rather than pushing a neighbour off-screen. The
                  button keeps its aria-label, so the full name is still
                  announced even if the visible text is clipped. */}
              <span className="w-full truncate text-center text-[10px] font-semibold uppercase leading-none tracking-[0.08em]">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
