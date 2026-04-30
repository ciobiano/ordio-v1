'use client'

import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
  
  
  

export type DockItem = {
  id: string
  label: string
  icon: IconSvgElement
}

interface DockProps {
  items: DockItem[]
  activeItem: string | null
  onItemClick: (id: string) => void
}

export function Dock({ items, activeItem, onItemClick }: DockProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[color:var(--glass-bg)] backdrop-blur-xl pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
      role="toolbar"
      aria-label="Export tools"
      style={{ height: 'calc(49px + env(safe-area-inset-bottom) + 8px)' }}
    >
      <div className="flex h-full items-center justify-around px-4">
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
                'flex flex-col items-center gap-0.5 px-5 py-1 transition-all duration-150',
                'min-h-[44px]',
                isActive
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/80'
              )}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={25}
                strokeWidth={1.5}
                className={cn('transition-opacity', isActive ? 'opacity-100' : 'opacity-60')}
                aria-hidden="true"
              />
              <span className="text-[10px] leading-none font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
