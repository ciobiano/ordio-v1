'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveformDisplay from '@/components/primitives/waveform/WaveformDisplay';
import type { WaveformVariant, CanvasLayout, FormatVariant } from '@/stores';
import { cn } from '@/lib/utils';

interface LandingPreviewMockProps {
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  canvasLayout?: CanvasLayout;
}

const CAPTION_WORDS = [
  { text: 'Today', duration: 0.3, delay: 0 },
  { text: "we're", duration: 0.2, delay: 0 },
  { text: 'talking', duration: 0.4, delay: 0 },
  { text: 'about', duration: 0.3, delay: 0 },
  { text: 'something', duration: 0.5, delay: 0 },
  { text: 'really', duration: 0.4, delay: 0 },
  { text: 'exciting.', duration: 0.5, delay: 1.2 }, 
];

function AnimatedCaptions({ isVertical }: { isVertical: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const tick = (index: number) => {
      setActiveIndex(index);
      const word = CAPTION_WORDS[index];
      const waitTime = (word.duration + word.delay) * 1000;
      timeout = setTimeout(() => {
        tick((index + 1) % CAPTION_WORDS.length);
      }, waitTime);
    };

    tick(0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-wrap justify-center gap-[0.3em] px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[90%]">
      {CAPTION_WORDS.map((word, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;
        
        return (
          <motion.span
            key={idx}
            animate={{
              color: isActive ? '#FFFFFF' : isPast ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
              scale: isActive ? 1.1 : 1,
              textShadow: isActive ? '0 0 16px rgba(255, 255, 255, 0.4)' : 'none',
              y: isActive ? -2 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
              mass: 0.5
            }}
            className={cn(
              "font-medium tracking-tight whitespace-pre-wrap",
              isVertical ? "text-base sm:text-lg" : "text-sm sm:text-base",
            )}
          >
            {word.text}
          </motion.span>
        );
      })}
    </div>
  );
}

const FORMAT_CONFIG: Record<FormatVariant, { label: string, ratio: number, width: string }> = {
  vertical: { label: '9:16', ratio: 9 / 16, width: 'w-[180px] sm:w-[220px]' },
  horizontal: { label: '16:9', ratio: 16 / 9, width: 'w-[320px] sm:w-[380px]' },
  square: { label: '1:1', ratio: 1 / 1, width: 'w-[240px] sm:w-[280px]' },
  instagram: { label: '4:5', ratio: 4 / 5, width: 'w-[220px] sm:w-[260px]' },
};

export default function LandingPreviewMock({ format, waveformStyle, canvasLayout = 'top' }: LandingPreviewMockProps) {
  const isVertical = format === 'vertical' || format === 'instagram';
  const config = FORMAT_CONFIG[format];

  // Map canvasLayout to internal placement
  const captionY = canvasLayout === 'flipped' ? '25%' : (isVertical ? 'calc(100% - 90px)' : 'calc(100% - 70px)');
  const waveformY = canvasLayout === 'flipped' ? '70%' : (isVertical ? '40%' : '50%');

  return (
    <div className="relative flex items-center justify-center w-full min-h-[450px] p-8 -mx-8 sm:mx-0 sm:p-4 bg-zinc-950/40 rounded-3xl border border-white/5 overflow-hidden">
      {/* Ambient glow behind preview to anchor it */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none mix-blend-screen opacity-[0.15]">
         <motion.div 
           layout
           className="w-[50%] h-[50%] bg-pink-500 blur-[100px] rounded-full" 
           animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }} 
           transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} 
         />
      </div>

      <motion.div
        layout
        className={cn(
          "relative bg-[#080808] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex-shrink-0 z-10",
          config.width
        )}
        style={{ aspectRatio: config.ratio }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
        role="img"
        aria-label={`Video preview - ${config.label} format`}
      >
        {/* Soft Inner Gradient simulating screen glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
        
        {/* Dynamic Badge */}
        <motion.div 
          layout
          className="absolute top-4 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-1.5 z-20"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-white/70 tracking-widest uppercase">
            {config.label}
          </span>
        </motion.div>

        {/* Waveform wrapper */}
        <AnimatePresence mode="popLayout">
          {waveformStyle !== 'none' && (
            <motion.div
              layout
              key="waveform"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, top: waveformY }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              className="absolute left-0 right-0 flex justify-center z-10 -translate-y-1/2"
            >
              <div className="relative">
                <WaveformDisplay variant={waveformStyle} level={0.5} isRecording={true} compact={true} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captions wrapper */}
        <motion.div
          layout
          className="absolute left-4 right-4 flex justify-center z-20 -translate-y-1/2"
          animate={{ top: captionY }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        >
          <AnimatedCaptions isVertical={isVertical} />
        </motion.div>
      </motion.div>
    </div>
  );
}
