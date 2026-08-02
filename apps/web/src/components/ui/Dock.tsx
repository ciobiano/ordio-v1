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
        'flex items-center gap-1 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden',
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
          className={cn(ordStickerBtn({ tone: 'paper', shape: 'round', size: 'icon' }), 'shrink-0')}
        >
          <HugeiconsIcon icon={leadingAction.icon} size={24} strokeWidth={2.6} />
        </button>
      )}

      <div className="flex flex-1 items-center justify-around">
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
                'flex min-h-12 cursor-pointer flex-col items-center gap-1.5 px-2 py-1',
                'transition-colors duration-[var(--acid-dur-tap)]',
                isActive
                  ? 'text-[color:var(--acid-accent)]'
                  : 'text-[color:var(--acid-text-1)]/60 hover:text-[color:var(--acid-text-1)]/85'
              )}
            >
              <HugeiconsIcon icon={item.icon} size={23} strokeWidth={1.9} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.1em]">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
