'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun01Icon, Moon01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

/**
 * Main-app-chrome light/dark toggle (see DESIGN.md — the ChatGPT-iOS
 * reference system's light values, inverted per Apple's iOS dark-mode
 * conventions). Independent of the Orb and the Acid share-card system,
 * which are unaffected by this toggle.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-chrome-full',
        'bg-chrome-bg-sunken text-chrome-text-primary transition-colors duration-150',
        className
      )}
    >
      {mounted && (
        <HugeiconsIcon icon={isDark ? Moon01Icon : Sun01Icon} size={20} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  )
}
