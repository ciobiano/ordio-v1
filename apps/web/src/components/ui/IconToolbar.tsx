'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ToolbarPanel = 'captions' | 'style' | 'format' | 'trim'

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
  { id: 'format',   label: 'Format',   iconSrc: '/icons/format.svg' },
  { id: 'trim',     label: 'Trim',     iconSrc: '/icons/trim.svg' },
]

export function IconToolbar({ activePanel, onPanelChange }: IconToolbarProps) {
  return (
    <div className="flex justify-around py-2 px-6">
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
            className="flex flex-col items-center gap-1 h-auto py-1 px-2 hover:bg-transparent"
          >
            <span
              className={cn(
                'w-11 h-11 rounded-lg flex items-center justify-center transition-colors',
                isActive ? 'bg-accent' : 'bg-muted'
              )}
            >
              <Image
                src={item.iconSrc}
                width={18}
                height={18}
                alt=""
                aria-hidden="true"
                className={cn('invert transition-opacity', isActive ? 'opacity-100' : 'opacity-50')}
              />
            </span>
            <span
              className={cn(
                'text-xs transition-colors',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              {item.label}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
