'use client'

import { cn } from '@/lib/cn'

export type ToolbarPanel = 'captions' | 'style' | 'format' | 'trim'

interface ToolbarItem {
  id: ToolbarPanel
  label: string
  icon: React.ReactNode
}

interface IconToolbarProps {
  activePanel: ToolbarPanel
  onPanelChange: (panel: ToolbarPanel) => void
}

const CaptionsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="4" width="16" height="10" rx="2" />
    <line x1="4" y1="8" x2="10" y2="8" strokeLinecap="round" />
    <line x1="4" y1="11" x2="14" y2="11" strokeLinecap="round" />
  </svg>
)

const StyleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="12" cy="7" r="2.5" />
    <circle cx="9" cy="13" r="2.5" />
  </svg>
)

const FormatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="12" height="12" rx="2" />
  </svg>
)

const TrimIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="5" r="2.5" />
    <circle cx="5" cy="13" r="2.5" />
    <line x1="7" y1="6" x2="16" y2="13" strokeLinecap="round" />
    <line x1="7" y1="12" x2="16" y2="5" strokeLinecap="round" />
  </svg>
)

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'captions', label: 'Captions', icon: <CaptionsIcon /> },
  { id: 'style', label: 'Style', icon: <StyleIcon /> },
  { id: 'format', label: 'Format', icon: <FormatIcon /> },
  { id: 'trim', label: 'Trim', icon: <TrimIcon /> },
]

export function IconToolbar({ activePanel, onPanelChange }: IconToolbarProps) {
  return (
    <div className="flex justify-around py-2 px-6">
      {TOOLBAR_ITEMS.map((item) => {
        const isActive = activePanel === item.id
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={isActive}
            className="flex flex-col items-center gap-1"
            onClick={() => onPanelChange(item.id)}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                isActive
                  ? 'bg-[--surface-active] text-[--primary]'
                  : 'bg-[--surface] text-[--secondary]'
              )}
            >
              {item.icon}
            </div>
            <span
              className={cn(
                'text-[10px] transition-colors',
                isActive ? 'text-[--primary] font-medium' : 'text-[--secondary]'
              )}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
