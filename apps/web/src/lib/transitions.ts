import type { Transition } from 'framer-motion';

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1,
};

export const gentleTransition: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 35,
  mass: 0.8,
};

export const snappyTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.5,
};

export const easeOutTransition: Transition = {
  ease: [0.22, 1, 0.36, 1],
  duration: 0.3,
};

export const pagePushVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: easeOutTransition,
  },
};

export const pageUpVariants = {
  hidden: {
    opacity: 0,
    y: '100%',
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: '-10%',
    transition: easeOutTransition,
  },
};

export const cardRevealVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...gentleTransition,
      delay: index * 0.08,
    },
  }),
};

export const fadeScaleVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: snappyTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: easeOutTransition,
  },
};

export const curtainRevealVariants = {
  hidden: {
    clipPath: 'inset(100% 0 0 0)',
  },
  visible: {
    clipPath: 'inset(0% 0 0 0)',
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 32,
    },
  },
  exit: {
    clipPath: 'inset(0% 0 100% 0)',
    transition: {
      ease: [0.22, 1, 0.36, 1],
      duration: 0.25,
    },
  },
};

export const staggeredContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggeredItemVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: gentleTransition,
  },
};

export const rippleVariants = {
  idle: {
    scale: 1,
    opacity: 0,
  },
  active: {
    scale: 1.4,
    opacity: 0.4,
    transition: {
      duration: 0.8,
      repeat: Infinity,
      repeatType: 'reverse',
    },
  },
};

export const pulseButtonVariants = {
  idle: {
    scale: 1,
  },
  hover: {
    scale: 1.03,
    transition: snappyTransition,
  },
  tap: {
    scale: 0.96,
    transition: {
      duration: 0.1,
    },
  },
};

export const toggleSwitchVariants = {
  off: {
    x: 0,
    transition: springTransition,
  },
  on: {
    x: '100%',
    transition: springTransition,
  },
};

export const listItemVariants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...gentleTransition,
      delay: index * 0.04,
    },
  }),
  tap: {
    scale: 0.98,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transition: { duration: 0.1 },
  },
};

export const shimmerVariants = {
  initial: {
    opacity: 0.6,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1.1,
    transition: {
      duration: 2.8,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
    },
  },
};