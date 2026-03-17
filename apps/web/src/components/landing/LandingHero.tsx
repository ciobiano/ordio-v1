'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Orb } from '@/components/primitives/Orb'

const BARS = [14,22,32,26,38,28,40,34,24,30,36,20,16,26,22,18,28,35,38,29,24,19,14,21]

const TAGS: { label: string; color: string; position: string }[] = [
  { label: 'AI Transcription', color: 'bg-[#22c55e] text-black',  position: 'top-[-10px] left-9 -rotate-[4deg]' },
  { label: 'Wave Styles',      color: 'bg-[#3b82f6] text-white',  position: 'top-[-10px] left-1/2 -translate-x-1/2 rotate-[2deg]' },
  { label: 'MP4 Export',       color: 'bg-[#a855f7] text-white',  position: 'top-[-10px] right-9 rotate-[4deg]' },
  { label: 'No Server',        color: 'bg-[#06b6d4] text-black',  position: 'top-1/2 left-1 -translate-y-1/2 -rotate-[6deg]' },
  { label: 'Caption Editor',   color: 'bg-[#f97316] text-white',  position: 'bottom-[-10px] left-11 rotate-[3deg]' },
  { label: 'Custom Fonts',     color: 'bg-[#ec4899] text-white',  position: 'bottom-[-10px] right-11 -rotate-[3deg]' },
]

export function LandingHero() {
  const shouldReduceMotion = useReducedMotion()
  const duration = shouldReduceMotion ? 0 : 0.8

  return (
    <div className={[
      'relative z-[1] grid mt-15',
      'grid-cols-1 lg:[grid-template-columns:1fr_180px_640px_180px_1fr]',
      "before:content-[''] before:absolute before:top-0 before:hidden before:lg:block before:left-[calc((100%-1000px)/2)] before:right-[calc((100%-1000px)/2)] before:h-px before:bg-white/[0.12] before:z-[2]",
      "after:content-[''] after:absolute after:bottom-0 after:hidden after:lg:block after:left-[calc((100%-1000px)/2)] after:right-[calc((100%-1000px)/2)] after:h-px after:bg-white/[0.12] after:z-[2]",
    ].join(' ')}>
      {/* Inner column dividers — desktop only */}
      <div className="hidden lg:block absolute top-0 bottom-0 w-px bg-white/[0.08] pointer-events-none left-[calc((100%-740px)/2)]" />
      <div className="hidden lg:block absolute top-0 bottom-0 w-px bg-white/[0.08] pointer-events-none right-[calc((100%-740px)/2)]" />

      {/* Crosshairs — desktop only */}
      <Crosshair className="hidden lg:block top-[-7px] left-[calc((100%-1000px)/2-9px)]" />
      <Crosshair className="hidden lg:block top-[-7px] right-[calc((100%-1000px)/2-9px)]" />
      <Crosshair className="hidden lg:block bottom-[-7px] left-[calc((100%-1000px)/2-9px)]" />
      <Crosshair className="hidden lg:block bottom-[-7px] right-[calc((100%-1000px)/2-9px)]" />

      {/* Hero content */}
      <div className="relative z-[1] col-span-full flex flex-col items-center gap-10 px-6 pt-12 sm:pt-20 lg:pt-30">
        {/* Mobile: Orb instead of app card */}
        <motion.div
          className="sm:hidden flex flex-col items-center gap-4 mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Orb state="resting" intensity={0} />
        </motion.div>

        {/* Desktop: App preview card — scale in */}
        <motion.div
          className="hidden sm:inline-block relative px-13 py-7 mb-13"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Feature tags — hidden on small mobile */}
          {TAGS.map((t) => (
            <span
              key={t.label}
              className={`hidden sm:block absolute px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.4)] z-[5] ${t.color} ${t.position}`}
            >
              {t.label}
            </span>
          ))}

          {/* App card */}
          <div className="bg-[#111] border border-white/[0.12] rounded-2xl overflow-hidden px-7 pt-3.5 pb-5 w-full max-w-[620px] shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Traffic lights */}
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.08]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
              <span className="ml-2 text-[13px] text-white/40">ordio.app — export preview</span>
            </div>

            {/* Caption */}
            <div className="text-center text-xs font-normal tracking-wide text-white/75 bg-white/[0.05] rounded-md px-3 py-1.5 mb-2.5">
              &ldquo;and that&apos;s the <span className="text-white">power of consistency</span> over time&rdquo;
            </div>

            {/* Waveform */}
            <div className="flex items-end justify-center h-11 gap-[3px] mb-2.5">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-white/50 to-white/90 wave-bar animate-wave-pulse"
                  style={{ height: `${h}px`, animationDelay: `${-(i * 0.12)}s` }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 px-6 py-3 bg-white/[0.04] rounded-full border border-white/[0.08] w-fit mx-auto">
              {/* Skip back */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M1 1.5a.5.5 0 0 1 .5.5v4.5L10 1.5a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.8.4L1.5 8V12a.5.5 0 0 1-1 0V2a.5.5 0 0 1 .5-.5zm9.5 1.56v7.88L2.63 7 10.5 3.06z"/>
                </svg>
              </button>

              {/* Play */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-black">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <path d="M2.5 1.5a.5.5 0 0 1 .76-.43l8 5a.5.5 0 0 1 0 .86l-8 5A.5.5 0 0 1 2.5 11.5v-10z"/>
                </svg>
              </button>

              {/* Skip forward */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M13 2a.5.5 0 0 0-1 0v4.5L3.5 1.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .8.4L12.5 8V12a.5.5 0 0 0 1 0V2zm-9.5 1.06L11.37 7 3.5 10.94V3.06z"/>
                </svg>
              </button>

              <div className="w-px h-5 bg-white/[0.12]" />

              {/* Music / waveform */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="5" width="2" height="4" rx="1"/>
                  <rect x="4.5" y="3" width="2" height="8" rx="1"/>
                  <rect x="8" y="5" width="2" height="4" rx="1"/>
                  <rect x="11.5" y="4" width="2" height="6" rx="1"/>
                </svg>
              </button>

              {/* Aa — text style */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white/70">
                Aa
              </button>

              {/* Square / background */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="2"/>
                </svg>
              </button>

              <div className="w-px h-5 bg-white/[0.12]" />

              {/* Download */}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
                  <path d="M6.5 1a.5.5 0 0 1 .5.5v6.29l1.65-1.65a.5.5 0 1 1 .7.71L6.5 9.71 3.65 6.85a.5.5 0 1 1 .7-.71L6 7.79V1.5a.5.5 0 0 1 .5-.5zM1.5 10a.5.5 0 0 0 0 1h10a.5.5 0 0 0 0-1h-10z"/>
                </svg>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          className="text-center max-w-[640px] mb-9"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="font-mono text-[length:var(--text-footnote)] tracking-[0.15em] uppercase text-white/40 mb-4">Browser-native audiogram generator</p>
          <h1 className="text-[length:var(--text-display)] font-normal tracking-[-1.5px] leading-[1.1] mb-5">
            Your voice,<br />beautifully visualised.
          </h1>
          <p className="text-[length:var(--text-body-lg)] text-white/50 leading-relaxed">
            Record or upload audio. Get <strong className="text-white/85 font-semibold">AI transcription</strong>. Export a stunning audiogram video —<br />
            all in the browser, no account required.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row gap-3 justify-center mb-10 sm:mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration * 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Link href="/create" className="bg-white text-black font-bold text-[15px] px-7 py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-white/90 transition-colors w-full sm:w-auto">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
              <path d="M1 .5a.5.5 0 0 1 .76-.43l8 5a.5.5 0 0 1 0 .86l-8 5A.5.5 0 0 1 1 10.5v-10z"/>
            </svg>
            Create Audiogram Free
          </Link>
          <button className="text-white/80 text-[15px] font-medium px-7 py-3.5 rounded-full border border-white/20 hover:bg-white/5 transition-colors w-full sm:w-auto">
            See how it works
          </button>
        </motion.div>
      </div>
    </div>
  )
}

function Crosshair({ className }: { className: string }) {
  return (
    <div className={`absolute w-5 h-5 pointer-events-none z-[5] ${className}`}>
      <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-white/80 -translate-x-1/2" />
      <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-white/80 -translate-y-1/2" />
    </div>
  )
}
