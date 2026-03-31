'use client'

import { motion, useAnimation, type Variants } from 'framer-motion'
import { useEffect } from 'react'

interface OrdioMarkProps {
  size?: number
  color?: string
}

// Container: stagger children in, then loop-pulse the whole group
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
  loop: {
    opacity: [1, 0.45, 1],
    scale: [1, 0.88, 1],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 as const },
  },
}

// Per-arc: x-offset slides arcs outward from center on enter/exit
// custom > 0 → left arc (hidden state shifted right toward center)
// custom < 0 → right arc (hidden state shifted left toward center)
// custom = 0 → circle (no x shift)
const arcVariants: Variants = {
  hidden: (xOffset: number) => ({ opacity: 0, x: xOffset, scale: 0.85 }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: (xOffset: number) => ({
    opacity: 0,
    x: xOffset,
    scale: 0.85,
    transition: { duration: 0.2, ease: 'easeIn' },
  }),
}

export function OrdioMark({ size = 80, color = 'white' }: OrdioMarkProps) {
  const controls = useAnimation()

  useEffect(() => {
    const run = async () => {
      await controls.start('visible')   // stagger arcs in once
      controls.start('loop')            // then breathe forever
    }
    run()
  }, [controls])

  return (
    <svg
      width={size}
      height={size * 0.5}
      // Cropped viewBox — removes dead space, makes mark fill the element
      viewBox="50 120 900 260"
      fill={color}
      aria-hidden="true"
    >
      <motion.g
        variants={containerVariants}
        initial="hidden"
        animate={controls}
        exit="exit"
      >
        {/* Center circle */}
        <motion.path
          custom={0}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 500 150 A 100 100 0 1 0 500 350 A 100 100 0 1 0 500 150 Z"
        />

        {/* Left arc 1 — innermost */}
        <motion.path
          custom={40}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 380 166.48 A 100 100 0 0 0 380 333.52 Z"
        />

        {/* Right arc 1 — innermost */}
        <motion.path
          custom={-40}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 620 166.48 A 100 100 0 0 1 620 333.52 Z"
        />

        {/* Left arc 2 */}
        <motion.path
          custom={60}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 315 178.59 A 100 100 0 0 0 315 321.41 Z"
        />

        {/* Right arc 2 */}
        <motion.path
          custom={-60}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 685 178.59 A 100 100 0 0 1 685 321.41 Z"
        />

        {/* Left arc 3 — outermost */}
        <motion.path
          custom={80}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 265 197.32 A 100 100 0 0 0 265 302.68 Z"
        />

        {/* Right arc 3 — outermost */}
        <motion.path
          custom={-80}
          variants={arcVariants}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          d="M 735 197.32 A 100 100 0 0 1 735 302.68 Z"
        />
      </motion.g>
    </svg>
  )
}
