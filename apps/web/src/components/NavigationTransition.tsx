'use client'

import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { TransitionOverlay } from './media/overlay/TransitionOverlay'

// ─── Context ────────────────────────────────────────────────────────────────

interface NavigationContextValue {
  navigate: (href: string) => void
  setLoading: (loading: boolean) => void
}

const NavigationContext = createContext<NavigationContextValue>({
  navigate: () => {},
  setLoading: () => {},
})

export function useNavigate() {
  return useContext(NavigationContext)
}

/** Hold the overlay open while an external loading condition is true */
export function useOverlayLoading(loading: boolean) {
  const { setLoading } = useContext(NavigationContext)
  useEffect(() => {
    setLoading(loading)
    return () => setLoading(false)
  }, [loading, setLoading])
}

// ─── Page variants ───────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 32,
    },
  },
}

const modalVariants: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 32,
      mass: 0.9,
    },
  },
  exit: {
    opacity: 0,
    y: '8%',
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * The loader has to stay up long enough to be read as the brand rather than a
 * flicker: the mark takes ~700ms to assemble, so a route that resolves in 80ms
 * still holds the overlay until the build has landed.
 */
const MIN_OVERLAY_MS = 900

export function NavigationTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // True on the server render too, so first paint is the loader rather than
  // the page flashing in before hydration adds the overlay on top of it.
  const [navOverlay, setNavOverlay] = useState(true)
  const [firstPaint, setFirstPaint] = useState(true)
  const [externalLoading, setExternalLoading] = useState(false)
  const prevPathname = useRef<string | null>(null)
  const shownAt = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const overlayVisible = navOverlay || externalLoading

  const hideOverlaySoon = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    const remaining = Math.max(0, MIN_OVERLAY_MS - (Date.now() - shownAt.current))
    hideTimer.current = setTimeout(() => {
      setNavOverlay(false)
      setFirstPaint(false)
    }, remaining)
  }, [])

  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname
      shownAt.current = Date.now()
      hideOverlaySoon()
      return
    }

    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      hideOverlaySoon()
    }
  }, [pathname, hideOverlaySoon])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      shownAt.current = Date.now()
      setNavOverlay(true)
      router.push(href)
    },
    [router],
  )

  const setLoading = useCallback((loading: boolean) => {
    setExternalLoading(loading)
  }, [])

  return (
    <NavigationContext.Provider value={{ navigate, setLoading }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {overlayVisible && <TransitionOverlay instant={firstPaint} />}
      </AnimatePresence>
    </NavigationContext.Provider>
  )
}
