'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface MascotProps {
  state?: 'idle' | 'listening' | 'speaking';
  greetingType?: 'morning' | 'afternoon' | 'evening' | 'welcome';
  className?: string;
}

interface EarBar {
  height: number;
  delay: number;
  duration: number;
}

function generateBars(count: number): EarBar[] {
  return Array.from({ length: count }, (_, i) => ({
    height: 30 + Math.random() * 70,
    delay: i * 0.15,
    duration: 1.2 + Math.random() * 0.8,
  }));
}

// Vibrant neon colors that POP on #000 background
const GREETING_COLORS = {
  morning: {
    body: '#00ff88',
    glow: '0 0 60px rgba(0,255,136,0.5), 0 0 100px rgba(0,255,136,0.2)',
    eye: '#ffffff',
    ring: 'rgba(0,255,136,0.15)',
  },
  afternoon: {
    body: '#00ccff',
    glow: '0 0 60px rgba(0,204,255,0.5), 0 0 100px rgba(0,204,255,0.2)',
    eye: '#ffffff',
    ring: 'rgba(0,204,255,0.15)',
  },
  evening: {
    body: '#ff6b35',
    glow: '0 0 60px rgba(255,107,53,0.5), 0 0 100px rgba(255,107,53,0.2)',
    eye: '#ffffff',
    ring: 'rgba(255,107,53,0.15)',
  },
  welcome: {
    body: '#8b5cf6',
    glow: '0 0 60px rgba(139,92,246,0.5), 0 0 100px rgba(139,92,246,0.2)',
    eye: '#ffffff',
    ring: 'rgba(139,92,246,0.15)',
  },
};

export function Mascot({ state = 'idle', greetingType = 'welcome', className }: MascotProps) {
  const [barsLeft] = useState<EarBar[]>(() => generateBars(8));
  const [barsRight] = useState<EarBar[]>(() => generateBars(8));

  const isActive = state === 'listening' || state === 'speaking';
  const colors = GREETING_COLORS[greetingType];

  return (
    <motion.div
      className={`relative flex items-center justify-center ${className || ''}`}
      animate={{ y: [0, -10, 0] }}
      transition={{
        duration: state === 'speaking' ? 1.5 : state === 'listening' ? 2 : 4,
        repeat: Infinity,
        ease: [0.22, 1, 0.36, 1] as any,
      }}
    >
      {/* Outer ring - sound wave */}
      <motion.div
        className="absolute w-48 h-48 rounded-full border"
        style={{ borderColor: colors.ring }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Middle ring */}
      <motion.div
        className="absolute w-40 h-40 rounded-full border"
        style={{ borderColor: colors.ring }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />

      {/* Main body - Claude-style circle */}
      <div
        className="relative w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: `${colors.body}22`,
          boxShadow: colors.glow,
          border: `2px solid ${colors.body}66`,
        }}
      >
        {/* Eyes */}
        <div className="flex gap-6 mt-2">
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: colors.eye }}
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{
              duration: state === 'speaking' ? 1 : state === 'listening' ? 2 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: colors.eye }}
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{
              duration: state === 'speaking' ? 1 : state === 'listening' ? 2 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Mouth */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 h-1 border-b-2 rounded-full"
          style={{ borderColor: colors.eye }}
          animate={{
            scaleX: state === 'speaking' ? [1, 1.3, 1, 1.2, 1] : 1,
          }}
          transition={{
            duration: state === 'speaking' ? 0.8 : 0.3,
            repeat: state === 'speaking' ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Inner ring */}
      <motion.div
        className="absolute w-24 h-24 rounded-full border"
        style={{ borderColor: colors.ring }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
    </motion.div>
  );
}
