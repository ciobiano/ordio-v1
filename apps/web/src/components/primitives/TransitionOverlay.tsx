'use client'

import { motion, type Variants } from 'framer-motion'
import { OrdioMark } from './OrdioMark'

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn', delay: 0.15 } },
}

export function TransitionOverlay() {
  return (
    <motion.div
      key="transition-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-hidden="true"
    >
      <OrdioMark size={280} color="white" />
    </motion.div>
  )
}
