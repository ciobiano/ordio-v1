'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

export function LandingFeatures() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start 0.85', 'end 0.5'],
  })

  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section className="relative z-[1] max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-12 items-stretch px-4 sm:px-8 lg:px-30 pt-18 pb-20">
      {/* Closing bottom border — aligned to outer column lines */}
      <div className="absolute bottom-0 left-[4%] right-[4%] lg:left-[calc(50%-500px)] lg:right-[calc(50%-500px)] h-px bg-white/10" />

      {/* Left column — heading */}
      <div className="pt-8 lg:pt-18">
        <h2 className="text-[length:var(--text-h2)] font-normal tracking-[-0.5px] leading-[var(--leading-heading)] mb-2">
          Record once.<br />Publish everywhere.
        </h2>
      </div>

      {/* Right column — vertical timeline */}
      <div ref={timelineRef} className="relative flex flex-col pt-18 pb-20 -mb-20 gap-[50px]">
        {/* Timeline spine (static background line) */}
        <div className="absolute left-[15px] -top-[70px] bottom-0 w-px bg-white/10" />

        {/* Gradient progress bar — scroll-driven */}
        <motion.div
          className="absolute left-3.5 top-18 w-0.5 h-[70%] rounded-sm bg-gradient-to-b from-[#EA5753] to-[#FFB88E] z-[1] origin-top"
          style={{ scaleY }}
        />

        {/* Step 01 — grouped capsule icon */}
        <div className="relative z-[2] flex gap-6 items-start pb-24">
          <div className="flex-shrink-0 w-[30px] flex flex-col items-center">
            <div className="w-[30px] border border-white/[0.14] rounded-[20px] bg-[#0a0a0a] overflow-hidden flex flex-col">
              <div className="w-[30px] h-10 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <div className="w-[30px] h-10 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--text-body-xl)] text-white/60 leading-[1.7]">
              <strong className="text-white/90 font-normal">Record or upload.</strong> Capture directly in the browser or drop in any MP3, WAV, or M4A file. No app to install.
            </p>
          </div>
        </div>

        {/* Step 02 — round icon */}
        <div className="relative z-[2] flex gap-6 items-start pb-24">
          <div className="flex-shrink-0 w-[30px] flex flex-col items-center">
            <div className="w-[38px] h-[38px] rounded-full bg-[#0a0a0a] border border-white/[0.22] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--text-body-xl)] text-white/60 leading-[1.7]">
              <strong className="text-white/90 font-normal">Instant AI transcription.</strong> Whisper-powered word-level captions appear automatically. Edit any word with a click.
            </p>
          </div>
        </div>

        {/* Step 03 — round icon */}
        <div className="relative z-[2] flex gap-6 items-start pb-24">
          <div className="flex-shrink-0 w-[30px] flex flex-col items-center">
            <div className="w-[38px] h-[38px] rounded-full bg-[#0a0a0a] border border-white/[0.22] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(6,182,212,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="19" cy="17" r="2.5" />
                <circle cx="6.5" cy="17" r="2.5" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--text-body-xl)] text-white/60 leading-[1.7]">
              <strong className="text-white/90 font-normal">Style it your way.</strong> Pick a waveform, font, colour, and aspect ratio. Preview updates live — what you see is what exports.
            </p>
          </div>
        </div>

        {/* Step 04 — round icon */}
        <div className="relative z-[2] flex gap-6 items-start">
          <div className="flex-shrink-0 w-[30px] flex flex-col items-center">
            <div className="w-[38px] h-[38px] rounded-full bg-[#0a0a0a] border border-white/[0.22] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--text-body-xl)] text-white/60 leading-[1.7]">
              <strong className="text-white/90 font-normal">Export and share.</strong> Download a crisp MP4 ready for Twitter, LinkedIn, Instagram, or TikTok.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
