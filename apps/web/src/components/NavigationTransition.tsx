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
import { TransitionOverlay } from './primitives/overlay/TransitionOverlay'

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
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function NavigationTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [navOverlay, setNavOverlay] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const prevPathname = useRef<string | null>(null)

  const overlayVisible = navOverlay || externalLoading

  useEffect(() => {
    if (prevPathname.current === null) {
      // Initial page load — show overlay as entry animation then clear
      prevPathname.current = pathname
      setNavOverlay(true)
      const timer = setTimeout(() => setNavOverlay(false), 800)
      return () => clearTimeout(timer)
    }

    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setNavOverlay(false)
    }
  }, [pathname])

  const navigate = useCallback(
    (href: string) => {
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
        {overlayVisible && <TransitionOverlay />}
      </AnimatePresence>
    </NavigationContext.Provider>
  )
}
