'use client'

import Link from 'next/link'
import { useState } from 'react'

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="relative z-10">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-12 py-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#6366f1"/>
            <rect x="5" y="13" width="3" height="10" rx="1.5" fill="white"/>
            <rect x="10" y="9" width="3" height="14" rx="1.5" fill="white"/>
            <rect x="15" y="6" width="3" height="17" rx="1.5" fill="white"/>
            <rect x="20" y="10" width="3" height="13" rx="1.5" fill="white"/>
          </svg>
          Ordio
        </Link>

        {/* Centre links — desktop only (routes not yet built) */}
        <div className="hidden md:flex gap-8 text-sm text-white/30">
          <span aria-disabled="true">Product</span>
          <span aria-disabled="true">Pricing</span>
          <span aria-disabled="true">Blog</span>
        </div>

        {/* Actions — desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/create"
            className="border border-white/15 text-white/80 px-5 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/create"
            className="bg-white text-black font-semibold px-5 py-2 rounded-lg text-sm hover:bg-white/90 transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile right side: CTA + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/create"
            className="bg-white text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-white/90 transition-colors min-h-[44px] flex items-center"
          >
            Get Started Free
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {menuOpen ? (
              /* X icon */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            ) : (
              /* Hamburger icon */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden absolute inset-x-0 top-full bg-black/95 backdrop-blur border-t border-white/10 px-4 py-4 flex flex-col gap-1">
          <span aria-disabled="true" className="text-white/25 min-h-[44px] flex items-center px-3 text-sm">
            Product
          </span>
          <span aria-disabled="true" className="text-white/25 min-h-[44px] flex items-center px-3 text-sm">
            Pricing
          </span>
          <span aria-disabled="true" className="text-white/25 min-h-[44px] flex items-center px-3 text-sm">
            Blog
          </span>
          <div className="mt-3 pt-3 border-t border-white/10">
            <Link
              href="/create"
              onClick={() => setMenuOpen(false)}
              className="border border-white/15 text-white/80 px-5 rounded-lg text-sm hover:bg-white/5 transition-colors min-h-[44px] flex items-center justify-center"
            >
              Log In
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
