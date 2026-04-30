'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type ToolbarPanel = 'captions' | 'style' | 'trim' | 'format'

interface ToolbarItem {
  id: ToolbarPanel
  label: string
  iconSrc: string
}

interface IconToolbarProps {
  activePanel: ToolbarPanel
  onPanelChange: (panel: ToolbarPanel) => void
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'captions', label: 'Captions', iconSrc: '/icons/captions.svg' },
  { id: 'style',    label: 'Style',    iconSrc: '/icons/style.svg' },
  { id: 'trim',     label: 'Trim',     iconSrc: '/icons/trim.svg' },
]

export function IconToolbar({ activePanel, onPanelChange }: IconToolbarProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex min-w-max gap-2 px-4 py-3">
        {TOOLBAR_ITEMS.map((item) => {
          const isActive = activePanel === item.id
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              aria-label={item.label}
              aria-pressed={isActive}
              onClick={() => onPanelChange(item.id)}
              className={cn(
                'mobile-glass-button flex h-12 items-center gap-2 rounded-2xl px-3.5 hover:bg-white/10',
                isActive && 'bg-white text-slate-950 hover:bg-white/92'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                  isActive ? 'bg-slate-950/10' : 'bg-white/8'
                )}
              >
                <Image
                  src={item.iconSrc}
                  width={16}
                  height={16}
                  alt=""
                  aria-hidden="true"
                  className={cn(
                    'transition-opacity',
                    isActive ? 'opacity-90' : 'invert opacity-70'
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-sm transition-colors',
                  isActive ? 'font-medium text-slate-950' : 'text-white/72'
                )}
              >
                {item.label}
              </span>
            </Button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
